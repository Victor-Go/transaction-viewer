import {
  API_ERROR_CODES,
  apiErrorResponseSchema,
  listTransactionsResponseSchema,
} from '@card-platform/contracts';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../../app.ts';
import { NOOP_LOGGER } from '../../../shared/observability/logger.ts';
import type { ListTransactionsExecutor } from './transaction-http.ts';

const writeDependencies = {
  getTransaction: {
    execute: async () => {
      throw new Error('not used');
    },
  },
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
  clock: { now: () => new Date('2026-07-20T18:31:00.000Z') },
};

const transaction = {
  id: 'txn-001',
  accountId: 'acc_demo',
  merchantName: 'Northern Grocer',
  amount: { minorUnits: 2599, currency: 'CAD' as const },
  status: 'posted' as const,
  transactionDate: new Date('2026-07-20T18:30:00.000Z'),
  createdAt: new Date('2026-07-20T18:31:00.000Z'),
  updatedAt: new Date('2026-07-20T18:31:00.000Z'),
  reversedAt: null,
};

describe('GET /api/v1/accounts/:accountId/transactions', () => {
  it('validates input and presents a contract-shaped page with totalCount', async () => {
    const listTransactions = {
      execute: async () => ({
        transactions: [transaction],
        pageSize: 20,
        totalCount: 45,
        hasMore: false as const,
        nextPageToken: null,
      }),
    } satisfies ListTransactionsExecutor;
    const response = await request(
      createApp({
        listTransactions,
        ...writeDependencies,
        logger: NOOP_LOGGER,
      }),
    ).get('/api/v1/accounts/acc_demo/transactions');

    expect(response.status).toBe(200);
    expect(listTransactionsResponseSchema.parse(response.body).meta).toEqual({
      pageSize: 20,
      returnedCount: 1,
      totalCount: 45,
      hasMore: false,
      nextPageToken: null,
    });
  });

  it.each([
    ['/api/v1/accounts/acc_demo/transactions?status=declined'],
    ['/api/v1/accounts/acc_demo/transactions?pageSize=0'],
    ['/api/v1/accounts/acc_demo/transactions?pageSize=20&pageSize=30'],
  ])('maps invalid requests to INVALID_REQUEST for %s', async (url) => {
    const listTransactions = {
      execute: async () => ({
        transactions: [],
        pageSize: 20,
        totalCount: 0,
        hasMore: false as const,
        nextPageToken: null,
      }),
    } satisfies ListTransactionsExecutor;
    const response = await request(
      createApp({
        listTransactions,
        ...writeDependencies,
        logger: NOOP_LOGGER,
      }),
    ).get(url);

    expect(response.status).toBe(400);
    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe(
      API_ERROR_CODES.INVALID_REQUEST,
    );
  });
});
