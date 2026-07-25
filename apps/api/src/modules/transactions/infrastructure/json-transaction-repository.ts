import type {
  ListTransactionsCriteria,
  ListTransactionsResult,
  TransactionRepository,
} from '../application/ports/transaction-repository.ts';
import type { JsonFileDatabase } from '../../../shared/persistence/json/json-file-database.ts';
import type { TransactionCollections } from './transaction-database.ts';
import { TransactionCursorCodec } from './transaction-cursor.ts';
import { transactionFromRecord } from './transaction-record.ts';
import type { Transaction } from '../domain/transaction.ts';

const compareDescending = (left: Transaction, right: Transaction): number => {
  const date = right.transactionDate.valueOf() - left.transactionDate.valueOf();
  if (date !== 0) return date;
  if (left.id === right.id) return 0;
  return left.id > right.id ? -1 : 1;
};

export class JsonTransactionRepository implements TransactionRepository {
  readonly #codec = new TransactionCursorCodec();

  constructor(
    private readonly database: JsonFileDatabase<TransactionCollections>,
  ) {}

  async findByAccountAndId(
    accountId: string,
    transactionId: string,
  ): Promise<Transaction | null> {
    const record = await this.database.findOne(
      'transactions',
      (candidate) =>
        candidate.accountId === accountId && candidate.id === transactionId,
    );
    return record === null ? null : transactionFromRecord(record);
  }

  async listByAccount(
    criteria: ListTransactionsCriteria,
  ): Promise<ListTransactionsResult> {
    const records = await this.database.find(
      'transactions',
      (record) =>
        record.accountId === criteria.accountId &&
        (criteria.status === undefined || record.status === criteria.status),
    );
    const totalCount = records.length;
    const transactions = records
      .map(transactionFromRecord)
      .sort(compareDescending);
    const boundary =
      criteria.pageToken === undefined
        ? undefined
        : this.#codec.decode(criteria.pageToken, {
            accountId: criteria.accountId,
            ...(criteria.status === undefined
              ? {}
              : { status: criteria.status }),
          });
    const afterBoundary =
      boundary === undefined
        ? transactions
        : transactions.filter(
            (transaction) =>
              transaction.transactionDate < boundary.transactionDate ||
              (transaction.transactionDate.valueOf() ===
                boundary.transactionDate.valueOf() &&
                transaction.id < boundary.id),
          );
    const inspected = afterBoundary.slice(0, criteria.pageSize + 1);
    const page = inspected.slice(0, criteria.pageSize);
    const hasMore = inspected.length > criteria.pageSize;
    const base = {
      transactions: page,
      pageSize: criteria.pageSize,
      totalCount,
    };
    if (!hasMore) {
      return { ...base, hasMore: false, nextPageToken: null };
    }
    const last = page.at(-1);
    if (last === undefined) {
      return { ...base, hasMore: false, nextPageToken: null };
    }
    return {
      ...base,
      transactions: page as [Transaction, ...Transaction[]],
      hasMore: true,
      nextPageToken: this.#codec.encode({
        accountId: criteria.accountId,
        ...(criteria.status === undefined ? {} : { status: criteria.status }),
        transactionDate: last.transactionDate,
        id: last.id,
      }),
    };
  }
}
