import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  API_ERROR_CODES,
  apiErrorResponseSchema,
  listTransactionsResponseSchema,
  type ListTransactionsResponse,
} from '@card-platform/contracts';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app.ts';
import { CreateTransaction } from './application/create-transaction.ts';
import { GetTransaction } from './application/get-transaction.ts';
import { ListTransactions } from './application/list-transactions.ts';
import { ReverseTransaction } from './application/reverse-transaction.ts';
import {
  createTransactionDatabase,
  initializeTransactionDatabase,
  type TransactionCollections,
} from './infrastructure/transaction-database.ts';
import { JsonTransactionRepository } from './infrastructure/json-transaction-repository.ts';
import { JsonTransactionCommandRepository } from './infrastructure/json-transaction-command-repository.ts';
import {
  CryptoTransactionIdGenerator,
  Sha256StringHasher,
} from './infrastructure/runtime-services.ts';
import type { JsonFileDatabase } from '../../shared/persistence/json/json-file-database.ts';
import type { ListTransactionsExecutor } from './http/transaction-http.ts';
import {
  type LogBindings,
  type Logger,
  NOOP_LOGGER,
} from '../../shared/observability/logger.ts';

let directory: string;
let database: JsonFileDatabase<TransactionCollections>;
let app: ReturnType<typeof createApp>;
let currentTime: Date;

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
  clock: { now: () => new Date('2026-05-15T00:00:00.000Z') },
};

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'transaction-api-'));
  database = createTransactionDatabase(
    path.join(directory, 'database.json'),
    NOOP_LOGGER,
  );
  await initializeTransactionDatabase(database, { seedDemo: true });
  currentTime = new Date('2026-05-15T00:00:00.000Z');
  const clock = { now: () => new Date(currentTime) };
  const commandRepository = new JsonTransactionCommandRepository(database);
  const repository = new JsonTransactionRepository(database);
  app = createApp({
    listTransactions: new ListTransactions(repository),
    getTransaction: new GetTransaction(repository),
    createTransaction: new CreateTransaction(
      commandRepository,
      clock,
      new CryptoTransactionIdGenerator(),
      new Sha256StringHasher(),
    ),
    reverseTransaction: new ReverseTransaction(
      commandRepository,
      clock,
      new Sha256StringHasher(),
    ),
    clock,
    logger: NOOP_LOGGER,
  });
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

const getPage = async (url: string): Promise<ListTransactionsResponse> => {
  const response = await request(app).get(url);
  expect(response.status).toBe(200);
  return listTransactionsResponseSchema.parse(response.body);
};

describe('transaction listing vertical slice', () => {
  it('retrieves three fixed-order pages without overlap and with exact totalCount', async () => {
    const first = await getPage('/api/v1/accounts/acc_demo/transactions');
    const second = await getPage(
      `/api/v1/accounts/acc_demo/transactions?pageToken=${first.meta.nextPageToken}`,
    );
    const third = await getPage(
      `/api/v1/accounts/acc_demo/transactions?pageToken=${second.meta.nextPageToken}`,
    );

    expect([first.data.length, second.data.length, third.data.length]).toEqual([
      20, 20, 5,
    ]);
    expect([
      first.meta.totalCount,
      second.meta.totalCount,
      third.meta.totalCount,
    ]).toEqual([45, 45, 45]);
    expect(third.meta).toMatchObject({
      returnedCount: 5,
      hasMore: false,
      nextPageToken: null,
    });
    const all = [...first.data, ...second.data, ...third.data];
    expect(new Set(all.map(({ id }) => id)).size).toBe(45);
    for (let index = 1; index < all.length; index += 1) {
      const previous = all[index - 1]!;
      const current = all[index]!;
      expect(
        previous.transactionDate > current.transactionDate ||
          (previous.transactionDate === current.transactionDate &&
            previous.id > current.id),
      ).toBe(true);
    }
    expect(all.every(({ accountId }) => accountId === 'acc_demo')).toBe(true);
  });

  it.each(['pending', 'posted', 'reversed'] as const)(
    'filters %s before counting and pagination',
    async (status) => {
      const page = await getPage(
        `/api/v1/accounts/acc_demo/transactions?status=${status}&pageSize=5`,
      );
      expect(page.meta).toMatchObject({
        pageSize: 5,
        returnedCount: 5,
        totalCount: 15,
        hasMore: true,
      });
      expect(
        page.data.every((transaction) => transaction.status === status),
      ).toBe(true);
    },
  );

  it('returns an empty final page for an unknown account', async () => {
    const page = await getPage('/api/v1/accounts/unknown/transactions');
    expect(page).toEqual({
      data: [],
      meta: {
        pageSize: 20,
        returnedCount: 0,
        totalCount: 0,
        hasMore: false,
        nextPageToken: null,
      },
    });
  });

  it('serves a persisted transaction at the maximum supported account ID length', async () => {
    const accountId = 'a'.repeat(128);
    await database.insert('transactions', {
      id: 'txn-max-account',
      accountId,
      merchantName: 'Boundary Merchant',
      amount: { minorUnits: 500, currency: 'CAD' },
      status: 'posted',
      transactionDate: '2026-06-01T00:00:00.000Z',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
      reversedAt: null,
    });

    const page = await getPage(`/api/v1/accounts/${accountId}/transactions`);

    expect(page.meta.totalCount).toBe(1);
    expect(page.data[0]).toMatchObject({ id: 'txn-max-account', accountId });
  });

  it('rejects malformed and scope-mismatched cursors', async () => {
    const first = await getPage(
      '/api/v1/accounts/acc_demo/transactions?status=posted&pageSize=5',
    );
    for (const url of [
      '/api/v1/accounts/acc_demo/transactions?pageToken=not%2Bbase64',
      `/api/v1/accounts/acc_secondary/transactions?status=posted&pageToken=${first.meta.nextPageToken}`,
      `/api/v1/accounts/acc_demo/transactions?status=pending&pageToken=${first.meta.nextPageToken}`,
    ]) {
      const response = await request(app).get(url);
      expect(response.status).toBe(400);
      expect(apiErrorResponseSchema.parse(response.body).error.code).toBe(
        API_ERROR_CODES.INVALID_REQUEST,
      );
    }
  });

  it('maps unexpected storage failures to a safe INTERNAL_ERROR', async () => {
    const errorEntries: LogBindings[] = [];
    const logger: Logger = {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: (bindings) => errorEntries.push(bindings),
      child: () => logger,
    };
    const failingApp = createApp({
      listTransactions: {
        execute: () => Promise.reject(new Error('C:\\secret\\database.json')),
      } satisfies ListTransactionsExecutor,
      ...writeDependencies,
      logger,
    });
    const response = await request(failingApp).get(
      '/api/v1/accounts/acc_demo/transactions',
    );
    expect(response.status).toBe(500);
    expect(apiErrorResponseSchema.parse(response.body)).toEqual({
      error: {
        code: API_ERROR_CODES.INTERNAL_ERROR,
        message: 'An internal error occurred.',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('secret');
    expect(errorEntries).toHaveLength(1);
    expect(errorEntries[0]).toMatchObject({
      component: 'transaction-http',
      method: 'GET',
      statusCode: 500,
    });
  });

  it('does not log expected INVALID_REQUEST responses as internal errors', async () => {
    let errorCount = 0;
    const logger: Logger = {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => {
        errorCount += 1;
      },
      child: () => logger,
    };
    const response = await request(
      createApp({
        listTransactions: new ListTransactions(
          new JsonTransactionRepository(database),
        ),
        ...writeDependencies,
        logger,
      }),
    ).get('/api/v1/accounts/acc_demo/transactions?pageSize=0');
    expect(response.status).toBe(400);
    expect(errorCount).toBe(0);
  });

  it('continues after the original boundary when newer records are inserted', async () => {
    const first = await getPage(
      '/api/v1/accounts/acc_demo/transactions?pageSize=5',
    );
    await database.insert('transactions', {
      id: 'txn-head',
      accountId: 'acc_demo',
      merchantName: 'Head Insert',
      amount: { minorUnits: 1234, currency: 'CAD' },
      status: 'posted',
      transactionDate: '2027-01-01T00:00:00.000Z',
      createdAt: '2027-01-01T00:00:00.000Z',
      updatedAt: '2027-01-01T00:00:00.000Z',
      reversedAt: null,
    });
    const second = await getPage(
      `/api/v1/accounts/acc_demo/transactions?pageSize=5&pageToken=${first.meta.nextPageToken}`,
    );
    expect(second.meta.totalCount).toBe(46);
    const forbiddenIds = new Set([
      'txn-head',
      ...first.data.map(({ id }) => id),
    ]);
    expect(second.data.some(({ id }) => forbiddenIds.has(id))).toBe(false);
  });

  it('creates once and persistently replays the original 201 response', async () => {
    const body = {
      merchantName: '  Northern Grocer  ',
      amount: { minorUnits: 2599, currency: 'CAD' },
    };
    const first = await request(app)
      .post('/api/v1/accounts/acc_demo/transactions')
      .set('Idempotency-Key', 'create-integration-key')
      .send(body);
    const replay = await request(app)
      .post('/api/v1/accounts/acc_demo/transactions')
      .set('Idempotency-Key', 'create-integration-key')
      .send(body);

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(first.body);
    expect(replay.headers.location).toBe(first.headers.location);
    expect(first.body.data).toMatchObject({
      accountId: 'acc_demo',
      merchantName: 'Northern Grocer',
      status: 'pending',
      canReverse: false,
      reversedAt: null,
    });
    expect(await database.find('idempotency')).toHaveLength(1);

    const location = first.headers.location;
    expect(location).toBeTypeOf('string');
    const resource = await request(app).get(location!);
    expect(resource.status).toBe(200);
    expect(resource.body).toEqual(first.body);

    for (const missingLocation of [
      `/api/v1/accounts/another-account/transactions/${first.body.data.id}`,
      '/api/v1/accounts/acc_demo/transactions/missing-transaction',
    ]) {
      const missing = await request(app).get(missingLocation);
      expect(missing.status).toBe(404);
      expect(missing.body).toEqual({
        error: {
          code: API_ERROR_CODES.TRANSACTION_NOT_FOUND,
          message: 'The transaction was not found.',
        },
      });
    }

    const conflict = await request(app)
      .post('/api/v1/accounts/acc_demo/transactions')
      .set('Idempotency-Key', 'create-integration-key')
      .send({
        merchantName: 'Different Merchant',
        amount: { minorUnits: 2599, currency: 'CAD' },
      });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe(API_ERROR_CODES.IDEMPOTENCY_CONFLICT);
  });

  it('does not consume an idempotency key for HTTP validation failure', async () => {
    const response = await request(app)
      .post('/api/v1/accounts/acc_demo/transactions')
      .set('Idempotency-Key', 'validation-rejection-key')
      .send({
        merchantName: 'Northern Grocer',
        amount: { minorUnits: 0, currency: 'CAD' },
      });

    expect(response.status).toBe(400);
    expect(await database.find('idempotency')).toEqual([]);
  });

  it('reverses exactly at the deadline, replays success, and rejects a new key', async () => {
    const transactionDate = '2026-05-01T00:00:00.000Z';
    await database.insert('transactions', {
      id: 'reversal-boundary',
      accountId: 'acc_demo',
      merchantName: 'Boundary Merchant',
      amount: { minorUnits: 500, currency: 'CAD' },
      status: 'posted',
      transactionDate,
      createdAt: transactionDate,
      updatedAt: transactionDate,
      reversedAt: null,
    });
    currentTime = new Date('2026-06-01T00:00:00.000Z');
    const url =
      '/api/v1/accounts/acc_demo/transactions/reversal-boundary/reversal';

    const first = await request(app)
      .post(url)
      .set('Idempotency-Key', 'reverse-integration-key')
      .send({});
    const replay = await request(app)
      .post(url)
      .set('Idempotency-Key', 'reverse-integration-key')
      .send({});
    expect(first.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    expect(first.body.data).toMatchObject({
      status: 'reversed',
      canReverse: false,
      reversedAt: currentTime.toISOString(),
      updatedAt: currentTime.toISOString(),
    });

    const secondCommand = await request(app)
      .post(url)
      .set('Idempotency-Key', 'another-reversal-key')
      .send({});
    expect(secondCommand.status).toBe(409);
    expect(secondCommand.body.error.code).toBe(
      API_ERROR_CODES.TRANSACTION_ALREADY_REVERSED,
    );
    expect(await database.find('idempotency')).toHaveLength(1);
  });

  it('maps pending, expired, and missing reversal attempts', async () => {
    for (const record of [
      {
        id: 'pending-reversal',
        status: 'pending' as const,
        transactionDate: '2026-05-01T00:00:00.000Z',
      },
      {
        id: 'expired-reversal',
        status: 'posted' as const,
        transactionDate: '2026-04-01T00:00:00.000Z',
      },
    ]) {
      await database.insert('transactions', {
        id: record.id,
        accountId: 'acc_demo',
        merchantName: 'Eligibility Merchant',
        amount: { minorUnits: 500, currency: 'CAD' },
        status: record.status,
        transactionDate: record.transactionDate,
        createdAt: record.transactionDate,
        updatedAt: record.transactionDate,
        reversedAt: null,
      });
    }
    currentTime = new Date('2026-06-01T00:00:00.001Z');

    const cases = [
      ['pending-reversal', 409, API_ERROR_CODES.TRANSACTION_NOT_POSTED],
      ['expired-reversal', 409, API_ERROR_CODES.REVERSAL_WINDOW_EXPIRED],
      ['missing-reversal', 404, API_ERROR_CODES.TRANSACTION_NOT_FOUND],
    ] as const;
    for (const [id, status, code] of cases) {
      const response = await request(app)
        .post(`/api/v1/accounts/acc_demo/transactions/${id}/reversal`)
        .set('Idempotency-Key', `key-${id}`)
        .send({});
      expect(response.status).toBe(status);
      expect(response.body.error.code).toBe(code);
    }
  });
});
