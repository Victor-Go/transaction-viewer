export const ACCOUNT_ID_MAX_LENGTH = 128;
export const TRANSACTION_ID_MAX_LENGTH = 64;

export const isValidAccountId = (id: string): boolean =>
  id.length >= 1 && id.length <= ACCOUNT_ID_MAX_LENGTH && id.trim() === id;

export const isValidTransactionId = (id: string): boolean =>
  id.length >= 1 && id.length <= TRANSACTION_ID_MAX_LENGTH && id.trim() === id;

export interface Money {
  readonly minorUnits: number;
  readonly currency: 'CAD';
}

interface TransactionCommonFields {
  readonly id: string;
  readonly accountId: string;
  readonly merchantName: string;
  readonly amount: Money;
  readonly transactionDate: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PendingTransaction extends TransactionCommonFields {
  readonly status: 'pending';
  readonly reversedAt: null;
}

export interface PostedTransaction extends TransactionCommonFields {
  readonly status: 'posted';
  readonly reversedAt: null;
}

export interface ReversedTransaction extends TransactionCommonFields {
  readonly status: 'reversed';
  readonly reversedAt: Date;
}

export type Transaction =
  PendingTransaction | PostedTransaction | ReversedTransaction;

export type TransactionStatus = Transaction['status'];
