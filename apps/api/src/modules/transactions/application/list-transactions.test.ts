import { describe, expect, it } from 'vitest';

import type { Transaction } from '../domain/transaction.ts';
import { ListTransactions } from './list-transactions.ts';
import type {
  ListTransactionsCriteria,
  ListTransactionsFinalPage,
  ListTransactionsPageWithMore,
  ListTransactionsResult,
  TransactionRepository,
} from './ports/transaction-repository.ts';

const postedTransaction: Transaction = {
  id: 'txn-posted',
  accountId: 'account-001',
  merchantName: 'Northern Grocer',
  amount: {
    minorUnits: 2599,
    currency: 'CAD',
  },
  status: 'posted',
  transactionDate: new Date('2026-07-20T18:30:00.000Z'),
  createdAt: new Date('2026-07-20T18:31:00.000Z'),
  updatedAt: new Date('2026-07-20T18:31:00.000Z'),
  reversedAt: null,
};

const pageWithMore = {
  transactions: [postedTransaction],
  pageSize: 20,
  totalCount: 21,
  hasMore: true,
  nextPageToken: 'next-opaque-cursor',
} satisfies ListTransactionsPageWithMore;

const finalNonEmptyPage = {
  transactions: [postedTransaction],
  pageSize: 20,
  totalCount: 1,
  hasMore: false,
  nextPageToken: null,
} satisfies ListTransactionsFinalPage;

const emptyFinalPage = {
  transactions: [],
  pageSize: 20,
  totalCount: 0,
  hasMore: false,
  nextPageToken: null,
} satisfies ListTransactionsFinalPage;

class RecordingTransactionRepository implements TransactionRepository {
  receivedCriteria: ListTransactionsCriteria | undefined;

  constructor(
    private readonly configuredResult: ListTransactionsResult,
    private readonly configuredFailure?: Error,
  ) {}

  async findByAccountAndId(): Promise<Transaction | null> {
    throw new Error('not used');
  }

  async listByAccount(
    criteria: ListTransactionsCriteria,
  ): Promise<ListTransactionsResult> {
    this.receivedCriteria = criteria;

    if (this.configuredFailure) {
      throw this.configuredFailure;
    }

    return this.configuredResult;
  }
}

describe('ListTransactions', () => {
  it('passes exactly the required criteria', async () => {
    const repository = new RecordingTransactionRepository(emptyFinalPage);
    const listTransactions = new ListTransactions(repository);

    await listTransactions.execute({
      accountId: 'account-001',
      pageSize: 20,
    });

    expect(repository.receivedCriteria).toEqual({
      accountId: 'account-001',
      pageSize: 20,
    });
  });

  it('passes all supported criteria', async () => {
    const repository = new RecordingTransactionRepository(emptyFinalPage);
    const listTransactions = new ListTransactions(repository);

    await listTransactions.execute({
      accountId: 'account-001',
      status: 'reversed',
      pageSize: 75,
      pageToken: 'opaque-cursor',
    });

    expect(repository.receivedCriteria).toEqual({
      accountId: 'account-001',
      status: 'reversed',
      pageSize: 75,
      pageToken: 'opaque-cursor',
    });
  });

  it('returns a page with more results', async () => {
    const repository = new RecordingTransactionRepository(pageWithMore);
    const listTransactions = new ListTransactions(repository);

    const result = await listTransactions.execute({
      accountId: 'account-001',
      pageSize: 20,
    });

    expect(result).toEqual(pageWithMore);
  });

  it('returns a final non-empty page', async () => {
    const repository = new RecordingTransactionRepository(finalNonEmptyPage);
    const listTransactions = new ListTransactions(repository);

    const result = await listTransactions.execute({
      accountId: 'account-001',
      pageSize: 20,
    });

    expect(result).toEqual(finalNonEmptyPage);
  });

  it('returns an empty final page', async () => {
    const repository = new RecordingTransactionRepository(emptyFinalPage);
    const listTransactions = new ListTransactions(repository);

    const result = await listTransactions.execute({
      accountId: 'unknown-account',
      pageSize: 20,
    });

    expect(result).toEqual(emptyFinalPage);
  });

  it('propagates repository failures unchanged', async () => {
    const failure = new Error('repository unavailable');
    const repository = new RecordingTransactionRepository(
      emptyFinalPage,
      failure,
    );
    const listTransactions = new ListTransactions(repository);

    await expect(
      listTransactions.execute({
        accountId: 'account-001',
        pageSize: 20,
      }),
    ).rejects.toBe(failure);
  });
});
