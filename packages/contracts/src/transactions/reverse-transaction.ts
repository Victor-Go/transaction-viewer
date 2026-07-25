import { z } from 'zod';

import {
  accountIdSchema,
  transactionDtoSchema,
  transactionIdSchema,
} from './transaction.ts';

export const reverseTransactionPathParamsSchema = z
  .object({
    accountId: accountIdSchema,
    transactionId: transactionIdSchema,
  })
  .strict();

export const reverseTransactionRequestSchema = z.object({}).strict();

export const reverseTransactionResponseSchema = z
  .object({ data: transactionDtoSchema })
  .strict();

export type ReverseTransactionPathParams = z.infer<
  typeof reverseTransactionPathParamsSchema
>;
export type ReverseTransactionResponse = z.infer<
  typeof reverseTransactionResponseSchema
>;
