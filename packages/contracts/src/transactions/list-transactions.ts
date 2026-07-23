import { z } from 'zod';

import {
  transactionDtoSchema,
  transactionStatusSchema,
} from './transaction.ts';

const opaquePageTokenSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine((value) => value.trim() === value, {
    message: 'Page token must not have surrounding whitespace',
  });

const pageSizeQuerySchema = z
  .union([
    z.number(),
    z
      .string()
      .regex(/^\d+$/, {
        message: 'Page size must be a decimal integer',
      })
      .transform(Number),
  ])
  .pipe(z.number().int().min(1).max(100))
  .default(20);

export const listTransactionsPathParamsSchema = z
  .object({
    accountId: z
      .string()
      .min(1)
      .max(128)
      .refine((value) => value.trim() === value, {
        message: 'Account ID must not have surrounding whitespace',
      }),
  })
  .strict();

export const listTransactionsQuerySchema = z
  .object({
    status: transactionStatusSchema.optional(),
    pageSize: pageSizeQuerySchema,
    pageToken: opaquePageTokenSchema.optional(),
  })
  .strict();

export const listTransactionsResponseSchema = z
  .object({
    data: z.array(transactionDtoSchema),
    meta: z
      .object({
        pageSize: z.number().int().min(1).max(100),
        returnedCount: z.number().int().nonnegative(),
        hasMore: z.boolean(),
        nextPageToken: opaquePageTokenSchema.nullable(),
      })
      .strict(),
  })
  .strict()
  .refine((response) => response.meta.returnedCount === response.data.length, {
    message: 'returnedCount must match the number of returned transactions',
    path: ['meta', 'returnedCount'],
  })
  .refine((response) => response.meta.returnedCount <= response.meta.pageSize, {
    message: 'returnedCount must not exceed pageSize',
    path: ['meta', 'returnedCount'],
  })
  .refine(
    (response) => !response.meta.hasMore || response.meta.returnedCount > 0,
    {
      message: 'An empty page cannot indicate that another page is available',
      path: ['meta', 'hasMore'],
    },
  )
  .refine(
    (response) =>
      response.meta.hasMore
        ? response.meta.nextPageToken !== null
        : response.meta.nextPageToken === null,
    {
      message: 'nextPageToken must be present exactly when hasMore is true',
      path: ['meta', 'nextPageToken'],
    },
  );

export type ListTransactionsPathParams = z.infer<
  typeof listTransactionsPathParamsSchema
>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type ListTransactionsResponse = z.infer<
  typeof listTransactionsResponseSchema
>;
