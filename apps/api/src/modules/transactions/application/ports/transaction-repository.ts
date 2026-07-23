import type {
  Transaction,
  TransactionStatus,
} from '../../domain/transaction.ts';

export interface ListTransactionsCriteria {
  readonly accountId: string;
  readonly status?: TransactionStatus;
  readonly pageSize: number;
  readonly pageToken?: string;
}

export interface ListTransactionsPageWithMore {
  readonly transactions: readonly [Transaction, ...Transaction[]];
  readonly hasMore: true;
  readonly nextPageToken: string;
}

export interface ListTransactionsFinalPage {
  readonly transactions: readonly Transaction[];
  readonly hasMore: false;
  readonly nextPageToken: null;
}

export type ListTransactionsResult =
  ListTransactionsPageWithMore | ListTransactionsFinalPage;

export interface TransactionRepository {
  listByAccount(
    criteria: ListTransactionsCriteria,
  ): Promise<ListTransactionsResult>;
}
