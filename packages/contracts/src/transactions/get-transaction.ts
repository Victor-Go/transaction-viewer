import { z } from 'zod';

import {
  accountIdSchema,
  transactionDtoSchema,
  transactionIdSchema,
} from './transaction.ts';

export const getTransactionPathParamsSchema = z
  .object({
    accountId: accountIdSchema,
    transactionId: transactionIdSchema,
  })
  .strict();

export const getTransactionResponseSchema = z
  .object({ data: transactionDtoSchema })
  .strict();

export type GetTransactionPathParams = z.infer<
  typeof getTransactionPathParamsSchema
>;
export type GetTransactionResponse = z.infer<
  typeof getTransactionResponseSchema
>;
