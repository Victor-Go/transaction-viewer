import { z } from 'zod';

export const transactionStatusSchema = z.enum([
  'pending',
  'posted',
  'reversed',
]);

export const ACCOUNT_ID_MAX_LENGTH = 128;

export const accountIdSchema = z
  .string()
  .min(1)
  .max(ACCOUNT_ID_MAX_LENGTH)
  .refine((value) => value.trim() === value, {
    message: 'Account ID must not have surrounding whitespace',
  });

export const moneyDtoSchema = z
  .object({
    minorUnits: z.number().int().nonnegative(),
    currency: z.literal('CAD'),
  })
  .strict();

const nonBlankResponseStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, {
    message: 'Value must contain a non-whitespace character',
  });

export const TRANSACTION_ID_MAX_LENGTH = 64;

export const transactionIdSchema = z
  .string()
  .min(1)
  .max(TRANSACTION_ID_MAX_LENGTH)
  .refine((value) => value.trim() === value, {
    message: 'Transaction ID must not have surrounding whitespace',
  });

const utcTimestampSchema = z.iso.datetime();

const transactionCommonFields = {
  id: transactionIdSchema,
  accountId: accountIdSchema,
  merchantName: nonBlankResponseStringSchema,
  amount: moneyDtoSchema,
  transactionDate: utcTimestampSchema,
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
  canReverse: z.boolean(),
  reverseExpiresAt: utcTimestampSchema,
};

const pendingTransactionDtoSchema = z
  .object({
    ...transactionCommonFields,
    status: z.literal('pending'),
    reversedAt: z.null(),
  })
  .strict();

const postedTransactionDtoSchema = z
  .object({
    ...transactionCommonFields,
    status: z.literal('posted'),
    reversedAt: z.null(),
  })
  .strict();

const reversedTransactionDtoSchema = z
  .object({
    ...transactionCommonFields,
    status: z.literal('reversed'),
    reversedAt: utcTimestampSchema,
  })
  .strict();

export const transactionDtoSchema = z.discriminatedUnion('status', [
  pendingTransactionDtoSchema,
  postedTransactionDtoSchema,
  reversedTransactionDtoSchema,
]);

export type TransactionStatus = z.infer<typeof transactionStatusSchema>;
export type MoneyDto = z.infer<typeof moneyDtoSchema>;
export type TransactionDto = z.infer<typeof transactionDtoSchema>;
