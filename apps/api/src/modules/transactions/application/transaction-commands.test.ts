import { describe, expect, it } from 'vitest';

import {
  IdempotencyConflictError,
  TransactionNotFoundError,
} from './errors/transaction-command.error.ts';
import { CreateTransaction } from './create-transaction.ts';
import { PostPendingTransactions } from './post-pending-transactions.ts';
import type {
  StoredTransactionCommand,
  TransactionCommandRepository,
  TransactionCommandSession,
} from './ports/transaction-command-repository.ts';
import { ReverseTransaction } from './reverse-transaction.ts';
import {
  ReversalWindowExpiredError,
  TransactionAlreadyReversedError,
  TransactionNotPostedError,
} from '../domain/transaction-policy.ts';
import type { Transaction } from '../domain/transaction.ts';

const posted = (overrides: Partial<Transaction> = {}): Transaction =>
  ({
    id: '00000000-0000-4000-8000-000000000001',
    accountId: 'acc_demo',
    merchantName: 'Northern Grocer',
    amount: { minorUnits: 2599, currency: 'CAD' },
    status: 'posted',
    transactionDate: new Date('2026-05-01T00:00:00.000Z'),
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    reversedAt: null,
    ...overrides,
  }) as Transaction;

class MemorySession implements TransactionCommandSession {
  readonly transactions: Transaction[] = [];
  readonly commands = new Map<string, StoredTransactionCommand>();

  findCommand(keyHash: string): StoredTransactionCommand | null {
    return this.commands.get(keyHash) ?? null;
  }

  saveCommand(command: StoredTransactionCommand): void {
    this.commands.set(command.keyHash, command);
  }

  hasTransactionId(id: string): boolean {
    return this.transactions.some((transaction) => transaction.id === id);
  }

  insertTransaction(transaction: Transaction): void {
    this.transactions.push(transaction);
  }

  findTransaction(
    accountId: string,
    transactionId: string,
  ): Transaction | null {
    return (
      this.transactions.find(
        (transaction) =>
          transaction.accountId === accountId &&
          transaction.id === transactionId,
      ) ?? null
    );
  }

  replaceTransaction(transaction: Transaction): void {
    const index = this.transactions.findIndex(
      (candidate) => candidate.id === transaction.id,
    );
    this.transactions[index] = transaction;
  }

  findPendingCreatedAtOrBefore(cutoff: Date): Transaction[] {
    return this.transactions.filter(
      (transaction) =>
        transaction.status === 'pending' && transaction.createdAt <= cutoff,
    );
  }
}

class MemoryRepository implements TransactionCommandRepository {
  readonly session = new MemorySession();

  async transaction<Result>(
    work: (session: TransactionCommandSession) => Result,
  ): Promise<Result> {
    return work(this.session);
  }
}

const clock = (instant: string) => ({
  now: () => new Date(instant),
});
const hasher = { hash: (value: string) => `hash:${value}` };

describe('CreateTransaction', () => {
  it('creates one pending UUID transaction with a single captured time', async () => {
    const repository = new MemoryRepository();
    let clockCalls = 0;
    const now = new Date('2026-05-10T12:00:00.000Z');
    const create = new CreateTransaction(
      repository,
      {
        now: () => {
          clockCalls += 1;
          return new Date(now);
        },
      },
      {
        generate: () => '00000000-0000-4000-8000-000000000002',
      },
      hasher,
    );

    const result = await create.execute({
      accountId: 'acc_demo',
      idempotencyKey: 'create-key',
      merchantName: 'Northern Grocer',
      amount: { minorUnits: 2599, currency: 'CAD' },
    });

    expect(clockCalls).toBe(1);
    expect(result.replayed).toBe(false);
    expect(result.transaction).toMatchObject({
      id: '00000000-0000-4000-8000-000000000002',
      accountId: 'acc_demo',
      status: 'pending',
      transactionDate: now,
      createdAt: now,
      updatedAt: now,
      reversedAt: null,
    });
    expect(repository.session.transactions).toHaveLength(1);
    expect(repository.session.commands).toHaveLength(1);
  });

  it('replays the original result and conflicts on different normalized input', async () => {
    const repository = new MemoryRepository();
    const create = new CreateTransaction(
      repository,
      clock('2026-05-10T12:00:00.000Z'),
      { generate: () => '00000000-0000-4000-8000-000000000003' },
      hasher,
    );
    const input = {
      accountId: 'acc_demo',
      idempotencyKey: 'create-key',
      merchantName: 'Northern Grocer',
      amount: { minorUnits: 2599, currency: 'CAD' as const },
    };

    const first = await create.execute(input);
    const replay = await create.execute(input);
    expect(replay).toEqual({ ...first, replayed: true });
    expect(repository.session.transactions).toHaveLength(1);

    await expect(
      create.execute({ ...input, merchantName: 'Different Merchant' }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(repository.session.transactions).toHaveLength(1);
  });

  it('retries UUID collisions without overwriting existing transactions', async () => {
    const repository = new MemoryRepository();
    repository.session.transactions.push(posted());
    const ids = [
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000004',
    ];
    const create = new CreateTransaction(
      repository,
      clock('2026-05-10T12:00:00.000Z'),
      { generate: () => ids.shift()! },
      hasher,
    );

    const result = await create.execute({
      accountId: 'acc_demo',
      idempotencyKey: 'collision-key',
      merchantName: 'Northern Grocer',
      amount: { minorUnits: 2599, currency: 'CAD' },
    });

    expect(result.transaction.id).toBe('00000000-0000-4000-8000-000000000004');
    expect(repository.session.transactions).toHaveLength(2);
  });

  it('fails safely after the bounded UUID collision retries', async () => {
    const repository = new MemoryRepository();
    repository.session.transactions.push(posted());
    const create = new CreateTransaction(
      repository,
      clock('2026-05-10T12:00:00.000Z'),
      { generate: () => posted().id },
      hasher,
    );

    await expect(
      create.execute({
        accountId: 'acc_demo',
        idempotencyKey: 'collision-failure-key',
        merchantName: 'Northern Grocer',
        amount: { minorUnits: 2599, currency: 'CAD' },
      }),
    ).rejects.toThrow('A unique transaction ID could not be generated');
    expect(repository.session.transactions).toHaveLength(1);
    expect(repository.session.commands).toHaveLength(0);
  });
});

describe('ReverseTransaction', () => {
  const createUseCase = (
    repository: MemoryRepository,
    instant: string,
  ): ReverseTransaction =>
    new ReverseTransaction(repository, clock(instant), hasher);

  it('reverses a posted transaction and replays the original timestamp', async () => {
    const repository = new MemoryRepository();
    repository.session.transactions.push(posted());
    const reverse = createUseCase(repository, '2026-05-10T12:00:00.000Z');
    const input = {
      accountId: 'acc_demo',
      transactionId: posted().id,
      idempotencyKey: 'reverse-key',
    };

    const first = await reverse.execute(input);
    const replay = await reverse.execute(input);
    expect(first.transaction.status).toBe('reversed');
    expect(first.transaction.updatedAt).toEqual(first.transaction.reversedAt);
    expect(replay).toEqual({ ...first, replayed: true });
  });

  it('enforces status, deadline, account scope, and key conflicts', async () => {
    const pendingRepository = new MemoryRepository();
    pendingRepository.session.transactions.push(
      posted({ status: 'pending', reversedAt: null }),
    );
    await expect(
      createUseCase(pendingRepository, '2026-05-10T12:00:00.000Z').execute({
        accountId: 'acc_demo',
        transactionId: posted().id,
        idempotencyKey: 'pending-key',
      }),
    ).rejects.toBeInstanceOf(TransactionNotPostedError);

    const expiredRepository = new MemoryRepository();
    expiredRepository.session.transactions.push(posted());
    await expect(
      createUseCase(expiredRepository, '2026-06-01T00:00:00.001Z').execute({
        accountId: 'acc_demo',
        transactionId: posted().id,
        idempotencyKey: 'expired-key',
      }),
    ).rejects.toBeInstanceOf(ReversalWindowExpiredError);

    const missingRepository = new MemoryRepository();
    missingRepository.session.transactions.push(posted());
    await expect(
      createUseCase(missingRepository, '2026-05-10T12:00:00.000Z').execute({
        accountId: 'another-account',
        transactionId: posted().id,
        idempotencyKey: 'missing-key',
      }),
    ).rejects.toBeInstanceOf(TransactionNotFoundError);

    const reversedRepository = new MemoryRepository();
    reversedRepository.session.transactions.push(
      posted({
        status: 'reversed',
        reversedAt: new Date('2026-05-02T00:00:00.000Z'),
      }),
    );
    await expect(
      createUseCase(reversedRepository, '2026-05-10T12:00:00.000Z').execute({
        accountId: 'acc_demo',
        transactionId: posted().id,
        idempotencyKey: 'already-key',
      }),
    ).rejects.toBeInstanceOf(TransactionAlreadyReversedError);
  });

  it('returns already reversed for a different key after success', async () => {
    const repository = new MemoryRepository();
    repository.session.transactions.push(posted());
    const reverse = createUseCase(repository, '2026-05-10T12:00:00.000Z');
    const input = {
      accountId: 'acc_demo',
      transactionId: posted().id,
      idempotencyKey: 'first-key',
    };
    await reverse.execute(input);
    await expect(
      reverse.execute({ ...input, idempotencyKey: 'different-key' }),
    ).rejects.toBeInstanceOf(TransactionAlreadyReversedError);
  });

  it('treats an idempotency key used by Create as a global conflict', async () => {
    const repository = new MemoryRepository();
    const create = new CreateTransaction(
      repository,
      clock('2026-05-01T00:00:00.000Z'),
      { generate: () => '00000000-0000-4000-8000-000000000005' },
      hasher,
    );
    const created = await create.execute({
      accountId: 'acc_demo',
      idempotencyKey: 'global-key',
      merchantName: 'Northern Grocer',
      amount: { minorUnits: 2599, currency: 'CAD' },
    });
    repository.session.replaceTransaction({
      ...created.transaction,
      status: 'posted',
      reversedAt: null,
    });

    await expect(
      createUseCase(repository, '2026-05-02T00:00:00.000Z').execute({
        accountId: 'acc_demo',
        transactionId: created.transaction.id,
        idempotencyKey: 'global-key',
      }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });
});

describe('PostPendingTransactions', () => {
  it('posts all eligible pending records atomically and is repeatable', async () => {
    const repository = new MemoryRepository();
    repository.session.transactions.push(
      posted({
        id: 'young',
        status: 'pending',
        createdAt: new Date('2026-05-01T00:00:00.001Z'),
        reversedAt: null,
      }),
      posted({
        id: 'exact',
        status: 'pending',
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        reversedAt: null,
      }),
      posted({
        id: 'old',
        status: 'pending',
        createdAt: new Date('2026-04-30T23:59:59.000Z'),
        reversedAt: null,
      }),
      posted({ id: 'posted' }),
      posted({
        id: 'reversed',
        status: 'reversed',
        reversedAt: new Date('2026-05-01T00:00:01.000Z'),
      }),
    );
    const posting = new PostPendingTransactions(
      repository,
      clock('2026-05-01T00:00:05.000Z'),
    );

    await expect(posting.execute()).resolves.toEqual({ postedCount: 2 });
    await expect(posting.execute()).resolves.toEqual({ postedCount: 0 });
    expect(
      repository.session.transactions.find(({ id }) => id === 'young')?.status,
    ).toBe('pending');
    for (const id of ['exact', 'old']) {
      expect(
        repository.session.transactions.find(
          (transaction) => transaction.id === id,
        ),
      ).toMatchObject({
        status: 'posted',
        updatedAt: new Date('2026-05-01T00:00:05.000Z'),
      });
    }
  });
});
