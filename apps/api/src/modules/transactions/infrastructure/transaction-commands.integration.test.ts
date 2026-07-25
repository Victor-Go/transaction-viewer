import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CreateTransaction } from '../application/create-transaction.ts';
import { IdempotencyConflictError } from '../application/errors/transaction-command.error.ts';
import { PostPendingTransactions } from '../application/post-pending-transactions.ts';
import { ReverseTransaction } from '../application/reverse-transaction.ts';
import { TransactionAlreadyReversedError } from '../domain/transaction-policy.ts';
import {
  ReversalWindowExpiredError,
  TransactionNotPostedError,
} from '../domain/transaction-policy.ts';
import { TransactionNotFoundError } from '../application/errors/transaction-command.error.ts';
import { NOOP_LOGGER } from '../../../shared/observability/logger.ts';
import { AtomicFileWriter } from '../../../shared/persistence/json/atomic-file-writer.ts';
import { JsonFileDatabase } from '../../../shared/persistence/json/json-file-database.ts';
import {
  createTransactionDatabase,
  initializeTransactionDatabase,
  transactionDatabaseSchema,
  type TransactionCollections,
} from './transaction-database.ts';
import { JsonTransactionCommandRepository } from './json-transaction-command-repository.ts';
import {
  CryptoTransactionIdGenerator,
  Sha256StringHasher,
} from './runtime-services.ts';

const directories: string[] = [];

const setup = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'transaction-command-'));
  directories.push(directory);
  const filePath = path.join(directory, 'database.json');
  const database = createTransactionDatabase(filePath, NOOP_LOGGER);
  await initializeTransactionDatabase(database, { seedDemo: false });
  return {
    database,
    filePath,
    repository: new JsonTransactionCommandRepository(database),
  };
};

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const clock = (instant: string) => ({ now: () => new Date(instant) });
const hasher = new Sha256StringHasher();
const createInput = {
  accountId: 'acc_demo',
  idempotencyKey: 'create-key',
  merchantName: 'Northern Grocer',
  amount: { minorUnits: 2599, currency: 'CAD' as const },
};

describe('transaction command persistence', () => {
  it('atomically persists one transaction and one command for concurrent replay', async () => {
    const { database, repository } = await setup();
    const create = new CreateTransaction(
      repository,
      clock('2026-05-10T12:00:00.000Z'),
      new CryptoTransactionIdGenerator(),
      hasher,
    );

    const [first, second] = await Promise.all([
      create.execute(createInput),
      create.execute(createInput),
    ]);

    expect(first.transaction.id).toBe(second.transaction.id);
    expect(await database.find('transactions')).toHaveLength(1);
    expect(await database.find('idempotency')).toHaveLength(1);
  });

  it('replays a create after reopening and rejects conflicting key reuse', async () => {
    const { filePath, repository } = await setup();
    const firstUseCase = new CreateTransaction(
      repository,
      clock('2026-05-10T12:00:00.000Z'),
      new CryptoTransactionIdGenerator(),
      hasher,
    );
    const first = await firstUseCase.execute(createInput);

    const reopened = createTransactionDatabase(filePath, NOOP_LOGGER);
    const reopenedUseCase = new CreateTransaction(
      new JsonTransactionCommandRepository(reopened),
      clock('2026-06-10T12:00:00.000Z'),
      new CryptoTransactionIdGenerator(),
      hasher,
    );
    const replay = await reopenedUseCase.execute(createInput);
    expect(replay.transaction).toEqual(first.transaction);
    await expect(
      reopenedUseCase.execute({
        ...createInput,
        merchantName: 'Different Merchant',
      }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it('serializes same-key and different-key concurrent reversals', async () => {
    const { repository } = await setup();
    const create = new CreateTransaction(
      repository,
      clock('2026-05-01T00:00:00.000Z'),
      new CryptoTransactionIdGenerator(),
      hasher,
    );
    const created = await create.execute(createInput);
    await new PostPendingTransactions(
      repository,
      clock('2026-05-01T00:00:05.000Z'),
    ).execute();
    const reverse = new ReverseTransaction(
      repository,
      clock('2026-05-02T00:00:00.000Z'),
      hasher,
    );
    const reverseInput = {
      accountId: 'acc_demo',
      transactionId: created.transaction.id,
      idempotencyKey: 'reverse-key',
    };

    const [first, replay] = await Promise.all([
      reverse.execute(reverseInput),
      reverse.execute(reverseInput),
    ]);
    expect(replay.transaction.reversedAt).toEqual(first.transaction.reversedAt);

    const results = await Promise.allSettled([
      reverse.execute({ ...reverseInput, idempotencyKey: 'different-one' }),
      reverse.execute({ ...reverseInput, idempotencyKey: 'different-two' }),
    ]);
    expect(
      results.every(
        (result) =>
          result.status === 'rejected' &&
          result.reason instanceof TransactionAlreadyReversedError,
      ),
    ).toBe(true);

    const secondCreated = await create.execute({
      ...createInput,
      idempotencyKey: 'second-create-key',
    });
    await new PostPendingTransactions(
      repository,
      clock('2026-05-01T00:00:05.000Z'),
    ).execute();
    const differentKeyResults = await Promise.allSettled([
      reverse.execute({
        accountId: 'acc_demo',
        transactionId: secondCreated.transaction.id,
        idempotencyKey: 'concurrent-key-one',
      }),
      reverse.execute({
        accountId: 'acc_demo',
        transactionId: secondCreated.transaction.id,
        idempotencyKey: 'concurrent-key-two',
      }),
    ]);
    expect(
      differentKeyResults.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      differentKeyResults.filter(
        (result) =>
          result.status === 'rejected' &&
          result.reason instanceof TransactionAlreadyReversedError,
      ),
    ).toHaveLength(1);
  });

  it('serializes posting and reversal through the same database lock', async () => {
    const { repository } = await setup();
    const create = new CreateTransaction(
      repository,
      clock('2026-05-01T00:00:00.000Z'),
      new CryptoTransactionIdGenerator(),
      hasher,
    );
    const created = await create.execute({
      ...createInput,
      idempotencyKey: 'posting-race-create',
    });
    const posting = new PostPendingTransactions(
      repository,
      clock('2026-05-01T00:00:05.000Z'),
    );
    const reverse = new ReverseTransaction(
      repository,
      clock('2026-05-01T00:00:05.000Z'),
      hasher,
    );

    const results = await Promise.allSettled([
      posting.execute(),
      reverse.execute({
        accountId: 'acc_demo',
        transactionId: created.transaction.id,
        idempotencyKey: 'posting-race-reverse',
      }),
    ]);
    const stored = await repository.transaction((session) =>
      session.findTransaction('acc_demo', created.transaction.id),
    );

    expect(results[0].status).toBe('fulfilled');
    expect(['posted', 'reversed']).toContain(stored?.status);
    expect(stored?.status).not.toBe('pending');
  });

  it('does not persist public eligibility projections', async () => {
    const { filePath, repository } = await setup();
    await new CreateTransaction(
      repository,
      clock('2026-05-10T12:00:00.000Z'),
      new CryptoTransactionIdGenerator(),
      hasher,
    ).execute(createInput);

    const serialized = await readFile(filePath, 'utf8');
    expect(serialized).not.toContain('canReverse');
    expect(serialized).not.toContain('reverseExpiresAt');
    expect(serialized).not.toContain(createInput.idempotencyKey);
  });

  it('does not consume a reversal key until a command succeeds', async () => {
    const { database, repository } = await setup();
    const create = new CreateTransaction(
      repository,
      clock('2026-05-01T00:00:00.000Z'),
      new CryptoTransactionIdGenerator(),
      hasher,
    );
    const created = await create.execute({
      ...createInput,
      idempotencyKey: 'pending-create-key',
    });
    const reversalKey = 'retry-after-posting';
    const pendingReverse = new ReverseTransaction(
      repository,
      clock('2026-05-01T00:00:01.000Z'),
      hasher,
    );

    await expect(
      pendingReverse.execute({
        accountId: 'acc_demo',
        transactionId: created.transaction.id,
        idempotencyKey: reversalKey,
      }),
    ).rejects.toBeInstanceOf(TransactionNotPostedError);
    expect(await database.find('idempotency')).toHaveLength(1);

    await new PostPendingTransactions(
      repository,
      clock('2026-05-01T00:00:05.000Z'),
    ).execute();
    const reverse = new ReverseTransaction(
      repository,
      clock('2026-05-02T00:00:00.000Z'),
      hasher,
    );
    const input = {
      accountId: 'acc_demo',
      transactionId: created.transaction.id,
      idempotencyKey: reversalKey,
    };
    const success = await reverse.execute(input);
    const replay = await reverse.execute(input);

    expect(success.transaction.status).toBe('reversed');
    expect(replay).toEqual({ ...success, replayed: true });
    expect(await database.find('idempotency')).toHaveLength(2);
  });

  it.each([
    [
      'not found',
      'missing',
      '2026-05-02T00:00:00.000Z',
      TransactionNotFoundError,
    ],
    [
      'expired',
      'expired-transaction',
      '2026-06-02T00:00:00.000Z',
      ReversalWindowExpiredError,
    ],
  ] as const)(
    'does not persist a key for a %s rejection',
    async (_case, transactionId, instant, ErrorType) => {
      const { database, repository } = await setup();
      if (transactionId === 'expired-transaction') {
        await database.insert('transactions', {
          id: transactionId,
          accountId: 'acc_demo',
          merchantName: 'Expired Merchant',
          amount: { minorUnits: 500, currency: 'CAD' },
          status: 'posted',
          transactionDate: '2026-05-01T00:00:00.000Z',
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:00:00.000Z',
          reversedAt: null,
        });
      }
      const reverse = new ReverseTransaction(
        repository,
        clock(instant),
        hasher,
      );

      await expect(
        reverse.execute({
          accountId: 'acc_demo',
          transactionId,
          idempotencyKey: `rejected-${transactionId}`,
        }),
      ).rejects.toBeInstanceOf(ErrorType);
      expect(await database.find('idempotency')).toEqual([]);
    },
  );

  it('does not persist a transaction or key when atomic replacement fails', async () => {
    const { database, filePath } = await setup();
    const failingDatabase = new JsonFileDatabase<TransactionCollections>({
      filePath,
      schema: transactionDatabaseSchema,
      logger: NOOP_LOGGER,
      atomicFileWriter: new AtomicFileWriter(async () => {
        throw new Error('replacement unavailable');
      }),
    });
    const create = new CreateTransaction(
      new JsonTransactionCommandRepository(failingDatabase),
      clock('2026-05-10T12:00:00.000Z'),
      new CryptoTransactionIdGenerator(),
      hasher,
    );

    await expect(
      create.execute({
        ...createInput,
        idempotencyKey: 'failed-persistence-key',
      }),
    ).rejects.toThrow();
    expect(await database.find('transactions')).toEqual([]);
    expect(await database.find('idempotency')).toEqual([]);
  });

  it('rejects malformed persisted idempotency records', async () => {
    const { database, filePath } = await setup();
    const document = JSON.parse(await readFile(filePath, 'utf8'));
    document.collections.idempotency.push({
      keyHash: 'not-a-sha-256-hash',
      operation: 'create-transaction',
    });
    await writeFile(filePath, JSON.stringify(document));

    await expect(database.find('idempotency')).rejects.toThrow();
  });
});
