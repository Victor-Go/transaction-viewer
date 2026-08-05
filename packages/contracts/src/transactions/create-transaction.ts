import { z } from 'zod';

import { transactionDtoSchema } from './transaction.ts';

export const MERCHANT_NAME_MAX_LENGTH = 120;
export const CREATE_TRANSACTION_MAX_MINOR_UNITS = 99_999_999_999;

export const createTransactionRequestSchema = z
  .object({
    merchantName: z.string().trim().min(1).max(MERCHANT_NAME_MAX_LENGTH),
    amount: z
      .object({
        minorUnits: z
          .number()
          .int()
          .positive()
          .max(CREATE_TRANSACTION_MAX_MINOR_UNITS),
        currency: z.literal('CAD'),
      })
      .strict(),
  })
  .strict();

export const createTransactionResponseSchema = z
  .object({ data: transactionDtoSchema })
  .strict();

export type CreateTransactionRequest = z.infer<
  typeof createTransactionRequestSchema
>;
export type CreateTransactionResponse = z.infer<
  typeof createTransactionResponseSchema
>;
