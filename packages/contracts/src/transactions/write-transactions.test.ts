import { describe, expect, it } from 'vitest';

import {
  CREATE_TRANSACTION_MAX_MINOR_UNITS,
  createTransactionRequestSchema,
} from './create-transaction.ts';
import { idempotencyKeySchema } from './idempotency-key.ts';
import { reverseTransactionPathParamsSchema } from './reverse-transaction.ts';
import { transactionDtoSchema } from './transaction.ts';

const validCreateRequest = {
  merchantName: 'Northern Grocer',
  amount: { minorUnits: 2599, currency: 'CAD' },
};

describe('createTransactionRequestSchema', () => {
  it('accepts and normalizes a valid purchase request', () => {
    expect(
      createTransactionRequestSchema.parse({
        merchantName: '  Northern Grocer  ',
        amount: { minorUnits: 2599, currency: 'CAD' },
      }),
    ).toEqual(validCreateRequest);
  });

  it('accepts the maximum purchase amount', () => {
    expect(
      createTransactionRequestSchema.safeParse({
        ...validCreateRequest,
        amount: {
          minorUnits: CREATE_TRANSACTION_MAX_MINOR_UNITS,
          currency: 'CAD',
        },
      }).success,
    ).toBe(true);
  });

  it.each([
    { ...validCreateRequest, status: 'posted' },
    { ...validCreateRequest, createdAt: '2026-01-01T00:00:00.000Z' },
    { ...validCreateRequest, accountId: 'acc_demo' },
  ])('rejects client-controlled fields', (body) => {
    expect(createTransactionRequestSchema.safeParse(body).success).toBe(false);
  });

  it.each([
    0,
    -1,
    1.5,
    CREATE_TRANSACTION_MAX_MINOR_UNITS + 1,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects invalid minor units %j', (minorUnits) => {
    expect(
      createTransactionRequestSchema.safeParse({
        ...validCreateRequest,
        amount: { minorUnits, currency: 'CAD' },
      }).success,
    ).toBe(false);
  });

  it('rejects currencies other than CAD', () => {
    expect(
      createTransactionRequestSchema.safeParse({
        ...validCreateRequest,
        amount: { minorUnits: 2599, currency: 'USD' },
      }).success,
    ).toBe(false);
  });
});

describe('write transaction path and header contracts', () => {
  it.each(['x', 'x'.repeat(128)])('accepts idempotency key %j', (key) => {
    expect(idempotencyKeySchema.parse(key)).toBe(key);
  });

  it.each(['', 'x'.repeat(129), ' key', 'key '])(
    'rejects idempotency key %j',
    (key) => {
      expect(idempotencyKeySchema.safeParse(key).success).toBe(false);
    },
  );

  it('validates reversal account and transaction identifiers', () => {
    const params = { accountId: 'acc_demo', transactionId: 'txn-001' };
    expect(reverseTransactionPathParamsSchema.parse(params)).toEqual(params);
    expect(
      reverseTransactionPathParamsSchema.safeParse({
        ...params,
        transactionId: 'x'.repeat(65),
      }).success,
    ).toBe(false);
  });
});

describe('transaction eligibility contract', () => {
  it('requires eligibility fields on the public transaction DTO', () => {
    const transaction = {
      id: 'txn-001',
      accountId: 'acc_demo',
      merchantName: 'Northern Grocer',
      amount: { minorUnits: 2599, currency: 'CAD' },
      status: 'posted',
      transactionDate: '2026-05-01T00:00:00.000Z',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      reversedAt: null,
      canReverse: true,
      reverseExpiresAt: '2026-06-01T00:00:00.000Z',
    };

    expect(transactionDtoSchema.parse(transaction)).toEqual(transaction);
    const missingEligibility: Partial<typeof transaction> = { ...transaction };
    delete missingEligibility.canReverse;
    expect(transactionDtoSchema.safeParse(missingEligibility).success).toBe(
      false,
    );
  });
});
