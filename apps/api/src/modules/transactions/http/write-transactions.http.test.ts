import {
  API_ERROR_CODES,
  CREATE_TRANSACTION_MAX_MINOR_UNITS,
  createTransactionResponseSchema,
  reverseTransactionResponseSchema,
} from '@card-platform/contracts';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../../app.ts';
import {
  IdempotencyConflictError,
  TransactionNotFoundError,
} from '../application/errors/transaction-command.error.ts';
import {
  ReversalWindowExpiredError,
  TransactionAlreadyReversedError,
  TransactionNotPostedError,
} from '../domain/transaction-policy.ts';
import type { Transaction } from '../domain/transaction.ts';
import type { Logger } from '../../../shared/observability/logger.ts';

const now = new Date('2026-05-10T12:00:00.000Z');
const pending: Transaction = {
  id: '00000000-0000-4000-8000-000000000001',
  accountId: 'acc_demo',
  merchantName: 'Northern Grocer',
  amount: { minorUnits: 2599, currency: 'CAD' },
  status: 'pending',
  transactionDate: now,
  createdAt: now,
  updatedAt: now,
  reversedAt: null,
};
const reversed: Transaction = {
  ...pending,
  status: 'reversed',
  updatedAt: now,
  reversedAt: now,
};

const dependencies = (
  overrides: Partial<Parameters<typeof createApp>[0]> = {},
) => {
  let errorCount = 0;
  const entries: Array<{
    level: 'info' | 'error';
    bindings: Readonly<Record<string, unknown>>;
  }> = [];
  const logger: Logger = {
    debug: () => undefined,
    info: (bindings) => entries.push({ level: 'info', bindings }),
    warn: () => undefined,
    error: (bindings) => {
      errorCount += 1;
      entries.push({ level: 'error', bindings });
    },
    child: () => logger,
  };
  return {
    dependencies: {
      listTransactions: {
        execute: async () => ({
          transactions: [],
          pageSize: 20,
          totalCount: 0,
          hasMore: false as const,
          nextPageToken: null,
        }),
      },
      getTransaction: {
        execute: async () => pending,
      },
      createTransaction: {
        execute: async () => ({ transaction: pending, replayed: false }),
      },
      reverseTransaction: {
        execute: async () => ({ transaction: reversed, replayed: false }),
      },
      clock: { now: () => new Date(now) },
      logger,
      ...overrides,
    },
    errorCount: () => errorCount,
    entries,
  };
};

describe('POST transaction commands', () => {
  it('creates a pending transaction with 201 and Location', async () => {
    const { dependencies: appDependencies } = dependencies();
    const response = await request(createApp(appDependencies))
      .post('/api/v1/accounts/acc_demo/transactions')
      .set('Idempotency-Key', 'create-key')
      .send({
        merchantName: 'Northern Grocer',
        amount: { minorUnits: 2599, currency: 'CAD' },
      });

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe(
      `/api/v1/accounts/acc_demo/transactions/${pending.id}`,
    );
    expect(createTransactionResponseSchema.parse(response.body)).toMatchObject({
      data: { status: 'pending', canReverse: false, reversedAt: null },
    });
  });

  it.each([
    [
      'missing key',
      undefined,
      { merchantName: 'A', amount: { minorUnits: 1, currency: 'CAD' } },
    ],
    [
      'blank key',
      ' ',
      { merchantName: 'A', amount: { minorUnits: 1, currency: 'CAD' } },
    ],
    [
      'invalid body',
      'key',
      { merchantName: 'A', amount: { minorUnits: 0, currency: 'CAD' } },
    ],
    [
      'amount above the maximum',
      'key',
      {
        merchantName: 'A',
        amount: {
          minorUnits: CREATE_TRANSACTION_MAX_MINOR_UNITS + 1,
          currency: 'CAD',
        },
      },
    ],
    [
      'client status',
      'key',
      {
        merchantName: 'A',
        amount: { minorUnits: 1, currency: 'CAD' },
        status: 'posted',
      },
    ],
  ])('rejects %s as INVALID_REQUEST', async (_case, key, body) => {
    const { dependencies: appDependencies, errorCount } = dependencies();
    let call = request(createApp(appDependencies))
      .post('/api/v1/accounts/acc_demo/transactions')
      .send(body);
    if (key !== undefined) call = call.set('Idempotency-Key', key);
    const response = await call;
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(API_ERROR_CODES.INVALID_REQUEST);
    expect(errorCount()).toBe(0);
  });

  it('rejects repeated Idempotency-Key headers and non-empty reversal bodies', async () => {
    const { dependencies: appDependencies } = dependencies();
    const repeated = await request(createApp(appDependencies))
      .post('/api/v1/accounts/acc_demo/transactions')
      .set('Idempotency-Key', ['one', 'two'] as never)
      .send({
        merchantName: 'Northern Grocer',
        amount: { minorUnits: 2599, currency: 'CAD' },
      });
    expect(repeated.status).toBe(400);

    const nonEmptyReversal = await request(createApp(appDependencies))
      .post('/api/v1/accounts/acc_demo/transactions/txn-001/reversal')
      .set('Idempotency-Key', 'reverse-key')
      .send({ status: 'reversed' });
    expect(nonEmptyReversal.status).toBe(400);
  });

  it('rejects a missing reversal key and malformed JSON as INVALID_REQUEST', async () => {
    const { dependencies: appDependencies } = dependencies();
    const missingKey = await request(createApp(appDependencies))
      .post('/api/v1/accounts/acc_demo/transactions/txn-001/reversal')
      .send({});
    expect(missingKey.status).toBe(400);

    const malformed = await request(createApp(appDependencies))
      .post('/api/v1/accounts/acc_demo/transactions')
      .set('Idempotency-Key', 'create-key')
      .set('Content-Type', 'application/json')
      .send('{"merchantName":');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe(API_ERROR_CODES.INVALID_REQUEST);
  });

  it.each([
    [
      new TransactionNotFoundError(),
      404,
      API_ERROR_CODES.TRANSACTION_NOT_FOUND,
      'transaction_not_found',
    ],
    [
      new TransactionNotPostedError(),
      409,
      API_ERROR_CODES.TRANSACTION_NOT_POSTED,
      'transaction_not_posted',
    ],
    [
      new TransactionAlreadyReversedError(),
      409,
      API_ERROR_CODES.TRANSACTION_ALREADY_REVERSED,
      'transaction_already_reversed',
    ],
    [
      new ReversalWindowExpiredError(),
      409,
      API_ERROR_CODES.REVERSAL_WINDOW_EXPIRED,
      'reversal_window_expired',
    ],
    [
      new IdempotencyConflictError(),
      409,
      API_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'idempotency_conflict',
    ],
  ] as const)(
    'maps and safely logs expected command rejections',
    async (failure, status, code, event) => {
      const configured = dependencies({
        reverseTransaction: { execute: async () => Promise.reject(failure) },
      });
      const response = await request(createApp(configured.dependencies))
        .post('/api/v1/accounts/acc_demo/transactions/txn-001/reversal')
        .set('Idempotency-Key', 'reverse-key')
        .send({});

      expect(response.status).toBe(status);
      expect(response.body.error.code).toBe(code);
      expect(configured.errorCount()).toBe(0);
      expect(configured.entries).toHaveLength(1);
      expect(configured.entries[0]).toMatchObject({
        level: 'info',
        bindings: {
          component: 'transaction-command',
          event,
          command: 'reverse-transaction',
          rejectionReason: event,
        },
      });
      expect(JSON.stringify(configured.entries)).not.toContain('reverse-key');
      expect(JSON.stringify(configured.entries)).not.toContain('txn-001');
      expect(JSON.stringify(configured.entries)).not.toContain('acc_demo');
    },
  );

  it('does not log successful commands or successful replays as rejected', async () => {
    let calls = 0;
    const configured = dependencies({
      createTransaction: {
        execute: async () => ({
          transaction: pending,
          replayed: calls++ > 0,
        }),
      },
    });
    const app = createApp(configured.dependencies);
    for (let index = 0; index < 2; index += 1) {
      const response = await request(app)
        .post('/api/v1/accounts/acc_demo/transactions')
        .set('Idempotency-Key', 'successful-key')
        .send({
          merchantName: 'Northern Grocer',
          amount: { minorUnits: 2599, currency: 'CAD' },
        });
      expect(response.status).toBe(201);
    }
    expect(configured.entries).toEqual([]);
  });

  it('URL-encodes the account segment in the created resource Location', async () => {
    const accountId = 'account with space';
    const configured = dependencies({
      createTransaction: {
        execute: async () => ({
          transaction: { ...pending, accountId },
          replayed: false,
        }),
      },
    });

    const response = await request(createApp(configured.dependencies))
      .post('/api/v1/accounts/account%20with%20space/transactions')
      .set('Idempotency-Key', 'encoded-location-key')
      .send({
        merchantName: 'Northern Grocer',
        amount: { minorUnits: 2599, currency: 'CAD' },
      });

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe(
      `/api/v1/accounts/account%20with%20space/transactions/${pending.id}`,
    );
  });

  it('reverses a posted transaction and returns a safe response', async () => {
    const { dependencies: appDependencies } = dependencies();
    const response = await request(createApp(appDependencies))
      .post('/api/v1/accounts/acc_demo/transactions/txn-001/reversal')
      .set('Idempotency-Key', 'reverse-key')
      .send({});

    expect(response.status).toBe(200);
    expect(reverseTransactionResponseSchema.parse(response.body)).toMatchObject(
      {
        data: {
          status: 'reversed',
          canReverse: false,
          reversedAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      },
    );
  });

  it('maps unexpected failures to a safe logged 500 without leaking the key', async () => {
    const logged: unknown[] = [];
    const logger: Logger = {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: (bindings) => logged.push(bindings),
      child: () => logger,
    };
    const { dependencies: appDependencies } = dependencies({
      createTransaction: {
        execute: async () => Promise.reject(new Error('secret detail')),
      },
      logger,
    });
    const response = await request(createApp(appDependencies))
      .post('/api/v1/accounts/acc_demo/transactions')
      .set('Idempotency-Key', 'never-log-this-key')
      .send({
        merchantName: 'Northern Grocer',
        amount: { minorUnits: 2599, currency: 'CAD' },
      });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe(API_ERROR_CODES.INTERNAL_ERROR);
    expect(JSON.stringify(logged)).not.toContain('never-log-this-key');
    expect(JSON.stringify(response.body)).not.toContain('secret detail');
  });
});
