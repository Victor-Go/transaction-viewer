import { z } from 'zod';

import { JsonFileDatabase } from '../../../shared/persistence/json/json-file-database.ts';
import type { JsonDatabaseDocument } from '../../../shared/persistence/json/json-file-database.types.ts';
import type { Logger } from '../../../shared/observability/logger.ts';
import { createDemoTransactionRecords } from './demo-transactions.ts';
import {
  transactionRecordSchema,
  type TransactionRecord,
} from './transaction-record.ts';
import {
  idempotencyRecordSchema,
  type IdempotencyRecord,
} from './idempotency-record.ts';

export interface TransactionCollections {
  readonly transactions: readonly TransactionRecord[];
  readonly idempotency: readonly IdempotencyRecord[];
}

const documentSchema = z
  .object({
    metadata: z.object({ schemaVersion: z.literal(1) }).strict(),
    collections: z
      .object({
        transactions: z.array(transactionRecordSchema),
        idempotency: z.array(idempotencyRecordSchema).default([]),
      })
      .strict(),
  })
  .strict()
  .superRefine((document, context) => {
    const ids = new Set<string>();
    for (const record of document.collections.transactions) {
      if (ids.has(record.id)) {
        context.addIssue({
          code: 'custom',
          message: 'Transaction IDs must be unique',
          path: ['collections', 'transactions'],
        });
      }
      ids.add(record.id);
    }
    const idempotencyKeys = new Set<string>();
    for (const record of document.collections.idempotency) {
      if (idempotencyKeys.has(record.keyHash)) {
        context.addIssue({
          code: 'custom',
          message: 'Idempotency key hashes must be unique',
          path: ['collections', 'idempotency'],
        });
      }
      idempotencyKeys.add(record.keyHash);
    }
  });

export const transactionDatabaseSchema = {
  schemaVersion: 1,
  parse(input: unknown): JsonDatabaseDocument<TransactionCollections> {
    return documentSchema.parse(input);
  },
};

export const createTransactionDatabase = (
  filePath: string,
  logger: Logger,
): JsonFileDatabase<TransactionCollections> =>
  new JsonFileDatabase({ filePath, schema: transactionDatabaseSchema, logger });

export const initializeTransactionDatabase = (
  database: JsonFileDatabase<TransactionCollections>,
  options: { readonly seedDemo: boolean },
) =>
  database.initialize({
    metadata: { schemaVersion: 1 },
    collections: {
      transactions: options.seedDemo ? createDemoTransactionRecords() : [],
      idempotency: [],
    },
  });
