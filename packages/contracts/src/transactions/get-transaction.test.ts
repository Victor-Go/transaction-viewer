import { describe, expect, it } from 'vitest';

import {
  getTransactionPathParamsSchema,
  getTransactionResponseSchema,
} from './get-transaction.ts';

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

describe('getTransactionPathParamsSchema', () => {
  it.each([
    ['x', 'y'],
    ['a'.repeat(128), 't'.repeat(64)],
    ['acc_demo', 'txn-001'],
  ])('accepts supported account and transaction IDs', (accountId, id) => {
    const params = { accountId, transactionId: id };
    expect(getTransactionPathParamsSchema.parse(params)).toEqual(params);
  });

  it.each([
    ['', 'txn-001'],
    ['a'.repeat(129), 'txn-001'],
    [' acc_demo', 'txn-001'],
    ['acc_demo ', 'txn-001'],
    ['acc_demo', ''],
    ['acc_demo', 't'.repeat(65)],
    ['acc_demo', ' txn-001'],
    ['acc_demo', 'txn-001 '],
  ])('rejects unsupported path IDs', (accountId, transactionId) => {
    expect(
      getTransactionPathParamsSchema.safeParse({
        accountId,
        transactionId,
      }).success,
    ).toBe(false);
  });

  it('rejects unknown path fields', () => {
    expect(
      getTransactionPathParamsSchema.safeParse({
        accountId: 'acc_demo',
        transactionId: 'txn-001',
        extra: 'not-allowed',
      }).success,
    ).toBe(false);
  });
});

describe('getTransactionResponseSchema', () => {
  it('reuses the public Transaction DTO response shape', () => {
    const response = { data: transaction };
    expect(getTransactionResponseSchema.parse(response)).toEqual(response);
  });

  it('rejects a response missing public eligibility fields', () => {
    const withoutEligibility: Partial<typeof transaction> = { ...transaction };
    delete withoutEligibility.canReverse;
    expect(
      getTransactionResponseSchema.safeParse({ data: withoutEligibility })
        .success,
    ).toBe(false);
  });

  it('rejects undeclared response fields', () => {
    expect(
      getTransactionResponseSchema.safeParse({
        data: transaction,
        meta: {},
      }).success,
    ).toBe(false);
  });
});
