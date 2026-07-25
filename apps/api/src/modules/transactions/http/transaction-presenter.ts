import type { TransactionDto } from '@card-platform/contracts';

import {
  canReverseTransaction,
  getReverseExpiresAt,
} from '../domain/transaction-policy.ts';
import type { Transaction } from '../domain/transaction.ts';

export const presentTransaction = (
  transaction: Transaction,
  now: Date,
): TransactionDto => {
  const common = {
    id: transaction.id,
    accountId: transaction.accountId,
    merchantName: transaction.merchantName,
    amount: { ...transaction.amount },
    transactionDate: transaction.transactionDate.toISOString(),
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
    canReverse: canReverseTransaction(transaction, now),
    reverseExpiresAt: getReverseExpiresAt(
      transaction.transactionDate,
    ).toISOString(),
  };
  return transaction.status === 'reversed'
    ? {
        ...common,
        status: 'reversed',
        reversedAt: transaction.reversedAt.toISOString(),
      }
    : { ...common, status: transaction.status, reversedAt: null };
};
