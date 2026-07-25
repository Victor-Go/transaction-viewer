import {
  API_ERROR_CODES,
  getTransactionResponseSchema,
} from '@card-platform/contracts';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../../app.ts';
import { TransactionNotFoundError } from '../application/errors/transaction-command.error.ts';
import type { Transaction } from '../domain/transaction.ts';
import type {
  LogBindings,
  Logger,
} from '../../../shared/observability/logger.ts';

const now = new Date('2026-05-15T00:00:00.000Z');
const posted: Transaction = {
  id: 'txn-001',
  accountId: 'acc_demo',
  merchantName: 'Northern Grocer',
  amount: { minorUnits: 2599, currency: 'CAD' },
  status: 'posted',
  transactionDate: new Date('2026-05-01T00:00:00.000Z'),
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  reversedAt: null,
};

const setup = (getTransaction: {
  execute(input: {
    accountId: string;
    transactionId: string;
  }): Promise<Transaction>;
}) => {
  const entries: Array<{ level: 'info' | 'error'; bindings: LogBindings }> = [];
  const logger: Logger = {
    debug: () => undefined,
    info: (bindings) => entries.push({ level: 'info', bindings }),
    warn: () => undefined,
    error: (bindings) => entries.push({ level: 'error', bindings }),
    child: () => logger,
  };
  return {
    app: createApp({
      listTransactions: {
        execute: async () => ({
          transactions: [],
          pageSize: 20,
          totalCount: 0,
          hasMore: false as const,
          nextPageToken: null,
        }),
      },
      getTransaction,
      createTransaction: {
        execute: async () => {
          throw new Error('not used');
        },
      },
      reverseTransaction: {
        execute: async () => {
          throw new Error('not used');
        },
      },
      clock: { now: () => new Date(now) },
      logger,
    }),
    entries,
  };
};

describe('GET /api/v1/accounts/:accountId/transactions/:transactionId', () => {
  it.each([
    ['pending', false],
    ['posted', true],
    ['reversed', false],
  ] as const)(
    'returns a contract-shaped %s transaction with current eligibility',
    async (status, canReverse) => {
      const transaction: Transaction =
        status === 'reversed'
          ? { ...posted, status, reversedAt: now, updatedAt: now }
          : { ...posted, status, reversedAt: null };
      const { app } = setup({ execute: async () => transaction });

      const response = await request(app).get(
        '/api/v1/accounts/acc_demo/transactions/txn-001',
      );

      expect(response.status).toBe(200);
      expect(getTransactionResponseSchema.parse(response.body)).toMatchObject({
        data: { status, canReverse },
      });
    },
  );

  it.each(['unknown transaction', 'account mismatch'])(
    'returns the same safe 404 for %s without internal-error logging',
    async () => {
      const { app, entries } = setup({
        execute: async () => {
          throw new TransactionNotFoundError();
        },
      });

      const response = await request(app).get(
        '/api/v1/accounts/another-account/transactions/txn-001',
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: {
          code: API_ERROR_CODES.TRANSACTION_NOT_FOUND,
          message: 'The transaction was not found.',
        },
      });
      expect(entries.filter(({ level }) => level === 'error')).toHaveLength(0);
    },
  );

  it.each([
    '/api/v1/accounts/%20acc_demo/transactions/txn-001',
    '/api/v1/accounts/acc_demo/transactions/%20txn-001',
    `/api/v1/accounts/${'a'.repeat(129)}/transactions/txn-001`,
    `/api/v1/accounts/acc_demo/transactions/${'t'.repeat(65)}`,
  ])('rejects invalid path input for %s', async (url) => {
    const { app } = setup({ execute: async () => posted });
    const response = await request(app).get(url);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(API_ERROR_CODES.INVALID_REQUEST);
  });

  it('maps unexpected persistence failure to a safe logged 500', async () => {
    const { app, entries } = setup({
      execute: async () => {
        throw new Error('sensitive persistence detail');
      },
    });

    const response = await request(app).get(
      '/api/v1/accounts/acc_demo/transactions/txn-001',
    );

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: API_ERROR_CODES.INTERNAL_ERROR,
        message: 'An internal error occurred.',
      },
    });
    expect(entries.filter(({ level }) => level === 'error')).toHaveLength(1);
    expect(JSON.stringify(entries)).not.toContain('sensitive persistence');
  });
});
