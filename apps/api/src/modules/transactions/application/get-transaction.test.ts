import { describe, expect, it } from 'vitest';

import { TransactionNotFoundError } from './errors/transaction-command.error.ts';
import { GetTransaction } from './get-transaction.ts';
import type {
  ListTransactionsCriteria,
  ListTransactionsResult,
  TransactionRepository,
} from './ports/transaction-repository.ts';
import type { Transaction } from '../domain/transaction.ts';

const transaction: Transaction = {
  id: 'txn-001',
  accountId: 'acc_demo',
  merchantName: 'Northern Grocer',
  amount: { minorUnits: 2599, currency: 'CAD' },
  status: 'posted',
  transactionDate: new Date('2026-05-01T00:00:00.000Z'),
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  reversedAt: null,
};

class RecordingRepository implements TransactionRepository {
  received:
    { readonly accountId: string; readonly transactionId: string } | undefined;

  constructor(
    private readonly result: Transaction | null,
    private readonly failure?: Error,
  ) {}

  async findByAccountAndId(
    accountId: string,
    transactionId: string,
  ): Promise<Transaction | null> {
    this.received = { accountId, transactionId };
    if (this.failure !== undefined) throw this.failure;
    return this.result;
  }

  async listByAccount(
    criteria: ListTransactionsCriteria,
  ): Promise<ListTransactionsResult> {
    void criteria;
    throw new Error('not used');
  }
}

describe('GetTransaction', () => {
  it('loads a transaction through the read repository', async () => {
    const repository = new RecordingRepository(transaction);
    const getTransaction = new GetTransaction(repository);

    await expect(
      getTransaction.execute({
        accountId: 'acc_demo',
        transactionId: 'txn-001',
      }),
    ).resolves.toBe(transaction);
    expect(repository.received).toEqual({
      accountId: 'acc_demo',
      transactionId: 'txn-001',
    });
  });

  it('uses the same not-found result for missing and account-mismatched records', async () => {
    const getTransaction = new GetTransaction(new RecordingRepository(null));

    await expect(
      getTransaction.execute({
        accountId: 'another-account',
        transactionId: 'txn-001',
      }),
    ).rejects.toBeInstanceOf(TransactionNotFoundError);
  });

  it('propagates unexpected repository failures', async () => {
    const failure = new Error('repository unavailable');
    const getTransaction = new GetTransaction(
      new RecordingRepository(null, failure),
    );

    await expect(
      getTransaction.execute({
        accountId: 'acc_demo',
        transactionId: 'txn-001',
      }),
    ).rejects.toBe(failure);
  });
});
