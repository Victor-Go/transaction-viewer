import type { Transaction } from '../../domain/transaction.ts';

export type TransactionCommandOperation =
  'create-transaction' | 'reverse-transaction';

export interface StoredTransactionCommand {
  readonly keyHash: string;
  readonly operation: TransactionCommandOperation;
  readonly fingerprintHash: string;
  readonly transaction: Transaction;
  readonly createdAt: Date;
}

export interface TransactionCommandSession {
  findCommand(keyHash: string): StoredTransactionCommand | null;
  saveCommand(command: StoredTransactionCommand): void;
  hasTransactionId(id: string): boolean;
  insertTransaction(transaction: Transaction): void;
  findTransaction(accountId: string, transactionId: string): Transaction | null;
  replaceTransaction(transaction: Transaction): void;
  findPendingCreatedAtOrBefore(cutoff: Date): Transaction[];
}

export interface TransactionCommandRepository {
  transaction<Result>(
    work: (session: TransactionCommandSession) => Result,
  ): Promise<Result>;
}
