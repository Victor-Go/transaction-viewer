import type {
  PostedTransaction,
  ReversedTransaction,
  Transaction,
  TransactionStatus,
} from './transaction.ts';

export const PENDING_POST_DELAY_MILLISECONDS = 5_000;
export const REVERSAL_WINDOW_MILLISECONDS = 31 * 24 * 60 * 60 * 1_000;

export const ALLOWED_TRANSACTION_STATUS_TRANSITIONS = {
  pending: ['posted'],
  posted: ['reversed'],
  reversed: [],
} as const satisfies Readonly<
  Record<TransactionStatus, readonly TransactionStatus[]>
>;

export type AllowedTransactionStatusTransition<
  FromStatus extends TransactionStatus,
> = (typeof ALLOWED_TRANSACTION_STATUS_TRANSITIONS)[FromStatus][number];

export class UnsupportedTransactionStatusTransitionError extends Error {
  constructor() {
    super('The transaction status transition is not supported');
    this.name = 'UnsupportedTransactionStatusTransitionError';
  }
}

export const canTransitionTransactionStatus = (
  fromStatus: TransactionStatus,
  toStatus: TransactionStatus,
): boolean =>
  (
    ALLOWED_TRANSACTION_STATUS_TRANSITIONS[
      fromStatus
    ] as readonly TransactionStatus[]
  ).includes(toStatus);

export const assertTransactionStatusTransition = (
  fromStatus: TransactionStatus,
  toStatus: TransactionStatus,
): void => {
  if (!canTransitionTransactionStatus(fromStatus, toStatus)) {
    throw new UnsupportedTransactionStatusTransitionError();
  }
};

export class TransactionNotPendingError extends Error {
  constructor() {
    super('Transaction is not pending');
    this.name = 'TransactionNotPendingError';
  }
}

export class TransactionNotPostedError extends Error {
  constructor() {
    super('Transaction is not posted');
    this.name = 'TransactionNotPostedError';
  }
}

export class TransactionAlreadyReversedError extends Error {
  constructor() {
    super('Transaction is already reversed');
    this.name = 'TransactionAlreadyReversedError';
  }
}

export class ReversalWindowExpiredError extends Error {
  constructor() {
    super('The reversal window has expired');
    this.name = 'ReversalWindowExpiredError';
  }
}

export const getReverseExpiresAt = (transactionDate: Date): Date =>
  new Date(transactionDate.valueOf() + REVERSAL_WINDOW_MILLISECONDS);

export const canReverseTransaction = (
  transaction: Transaction,
  now: Date,
): boolean =>
  transaction.status === 'posted' &&
  now.valueOf() <= getReverseExpiresAt(transaction.transactionDate).valueOf();

export const reversePostedTransaction = (
  transaction: Transaction,
  now: Date,
): ReversedTransaction => {
  if (transaction.status === 'reversed') {
    throw new TransactionAlreadyReversedError();
  }
  if (transaction.status !== 'posted') {
    throw new TransactionNotPostedError();
  }
  if (!canReverseTransaction(transaction, now)) {
    throw new ReversalWindowExpiredError();
  }
  assertTransactionStatusTransition(transaction.status, 'reversed');
  return {
    ...transaction,
    status: 'reversed',
    updatedAt: now,
    reversedAt: now,
  };
};

export const isPendingPostingEligible = (
  transaction: Transaction,
  now: Date,
): boolean =>
  transaction.status === 'pending' &&
  transaction.createdAt.valueOf() <=
    now.valueOf() - PENDING_POST_DELAY_MILLISECONDS;

export const postPendingTransaction = (
  transaction: Transaction,
  now: Date,
): PostedTransaction => {
  if (transaction.status !== 'pending') {
    throw new TransactionNotPendingError();
  }
  assertTransactionStatusTransition(transaction.status, 'posted');
  return {
    ...transaction,
    status: 'posted',
    updatedAt: now,
    reversedAt: null,
  };
};
