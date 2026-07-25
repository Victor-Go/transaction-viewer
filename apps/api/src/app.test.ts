import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.ts';
import type { ListTransactionsExecutor } from './modules/transactions/http/transaction-http.ts';
import { NOOP_LOGGER } from './shared/observability/logger.ts';

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
  clock: { now: () => new Date('2026-05-01T00:00:00.000Z') },
};

describe('API application', () => {
  it('exports only an import-safe application factory', async () => {
    const applicationModule = await import('./app.ts');
    expect(applicationModule).not.toHaveProperty('app');
  });

  it('reports its health without starting a listener', async () => {
    const listTransactions = {
      execute: async () => ({
        transactions: [],
        pageSize: 20,
        totalCount: 0,
        hasMore: false as const,
        nextPageToken: null,
      }),
    } satisfies ListTransactionsExecutor;
    const app = createApp({
      listTransactions,
      ...writeDependencies,
      logger: NOOP_LOGGER,
    });
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
