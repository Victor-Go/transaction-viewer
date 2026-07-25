import { z } from 'zod';

import {
  isValidAccountId,
  isValidTransactionId,
  type Transaction,
} from '../domain/transaction.ts';

const nonBlank = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0);
const utcTimestamp = z.iso.datetime();
const common = {
  id: z.string().refine(isValidTransactionId),
  accountId: z.string().refine(isValidAccountId),
  merchantName: nonBlank,
  amount: z
    .object({
      minorUnits: z.number().int().nonnegative(),
      currency: z.literal('CAD'),
    })
    .strict(),
  transactionDate: utcTimestamp,
  createdAt: utcTimestamp,
  updatedAt: utcTimestamp,
};

export const transactionRecordSchema = z.discriminatedUnion('status', [
  z
    .object({ ...common, status: z.literal('pending'), reversedAt: z.null() })
    .strict(),
  z
    .object({ ...common, status: z.literal('posted'), reversedAt: z.null() })
    .strict(),
  z
    .object({
      ...common,
      status: z.literal('reversed'),
      reversedAt: utcTimestamp,
    })
    .strict(),
]);

export type TransactionRecord = z.infer<typeof transactionRecordSchema>;

export const transactionFromRecord = (
  record: TransactionRecord,
): Transaction => {
  const common = {
    id: record.id,
    accountId: record.accountId,
    merchantName: record.merchantName,
    amount: { ...record.amount },
    transactionDate: new Date(record.transactionDate),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
  return record.status === 'reversed'
    ? {
        ...common,
        status: 'reversed',
        reversedAt: new Date(record.reversedAt),
      }
    : { ...common, status: record.status, reversedAt: null };
};

export const transactionToRecord = (
  transaction: Transaction,
): TransactionRecord => {
  const common = {
    id: transaction.id,
    accountId: transaction.accountId,
    merchantName: transaction.merchantName,
    amount: { ...transaction.amount },
    transactionDate: transaction.transactionDate.toISOString(),
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
  return transaction.status === 'reversed'
    ? {
        ...common,
        status: 'reversed',
        reversedAt: transaction.reversedAt.toISOString(),
      }
    : { ...common, status: transaction.status, reversedAt: null };
};
