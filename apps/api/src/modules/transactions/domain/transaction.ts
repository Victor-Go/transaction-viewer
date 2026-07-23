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
