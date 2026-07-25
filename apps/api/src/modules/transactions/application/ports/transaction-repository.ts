import type {
  Transaction,
  TransactionStatus,
} from '../../domain/transaction.ts';

export interface ListTransactionsCriteria {
  readonly accountId: string;
  readonly status?: TransactionStatus;
  readonly pageSize: number;
  readonly pageToken?: string;
  readonly from?: Date;
  readonly to?: Date;
}

export interface ListTransactionsPageWithMore {
  readonly transactions: readonly [Transaction, ...Transaction[]];
  readonly pageSize: number;
  readonly totalCount: number;
  readonly hasMore: true;
  readonly nextPageToken: string;
}

export interface ListTransactionsFinalPage {
  readonly transactions: readonly Transaction[];
  readonly pageSize: number;
  readonly totalCount: number;
  readonly hasMore: false;
  readonly nextPageToken: null;
}

export type ListTransactionsResult =
  ListTransactionsPageWithMore | ListTransactionsFinalPage;

export interface TransactionRepository {
  findByAccountAndId(
    accountId: string,
    transactionId: string,
  ): Promise<Transaction | null>;
  listByAccount(
    criteria: ListTransactionsCriteria,
  ): Promise<ListTransactionsResult>;
}
