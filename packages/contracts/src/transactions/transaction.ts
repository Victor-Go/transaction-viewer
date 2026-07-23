import { z } from 'zod';

export const transactionStatusSchema = z.enum([
  'pending',
  'posted',
  'reversed',
]);

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

const utcTimestampSchema = z.iso.datetime();

const transactionCommonFields = {
  id: nonBlankResponseStringSchema,
  accountId: nonBlankResponseStringSchema,
  merchantName: nonBlankResponseStringSchema,
  amount: moneyDtoSchema,
  transactionDate: utcTimestampSchema,
  createdAt: utcTimestampSchema,
  updatedAt: utcTimestampSchema,
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
