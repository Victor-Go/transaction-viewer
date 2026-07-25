import { z } from 'zod';

import { transactionRecordSchema } from './transaction-record.ts';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const idempotencyRecordSchema = z.discriminatedUnion('operation', [
  z
    .object({
      keyHash: sha256Schema,
      operation: z.literal('create-transaction'),
      fingerprintHash: sha256Schema,
      httpStatus: z.literal(201),
      transaction: transactionRecordSchema.refine(
        (transaction) => transaction.status === 'pending',
      ),
      createdAt: z.iso.datetime(),
    })
    .strict(),
  z
    .object({
      keyHash: sha256Schema,
      operation: z.literal('reverse-transaction'),
      fingerprintHash: sha256Schema,
      httpStatus: z.literal(200),
      transaction: transactionRecordSchema.refine(
        (transaction) => transaction.status === 'reversed',
      ),
      createdAt: z.iso.datetime(),
    })
    .strict(),
]);

export type IdempotencyRecord = z.infer<typeof idempotencyRecordSchema>;
