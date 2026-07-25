import { describe, expect, it } from 'vitest';

import type { Transaction } from '../domain/transaction.ts';
import { presentTransaction } from './transaction-presenter.ts';

const transaction = (
  status: Transaction['status'],
  transactionDate = new Date('2026-05-01T00:00:00.000Z'),
): Transaction => {
  const common = {
    id: 'txn-001',
    accountId: 'acc_demo',
    merchantName: 'Northern Grocer',
    amount: { minorUnits: 2599, currency: 'CAD' as const },
    transactionDate,
    createdAt: transactionDate,
    updatedAt: transactionDate,
  };
  return status === 'reversed'
    ? { ...common, status, reversedAt: transactionDate }
    : { ...common, status, reversedAt: null };
};

describe('presentTransaction', () => {
  const deadline = new Date('2026-06-01T00:00:00.000Z');

  it.each([
    ['pending', new Date('2026-05-02T00:00:00.000Z'), false],
    ['posted', new Date('2026-05-31T23:59:59.999Z'), true],
    ['posted', deadline, true],
    ['posted', new Date(deadline.valueOf() + 1), false],
    ['reversed', new Date('2026-05-02T00:00:00.000Z'), false],
  ] as const)(
    'projects %s eligibility at %s',
    (status, now, expectedCanReverse) => {
      const result = presentTransaction(transaction(status), now);
      expect(result.canReverse).toBe(expectedCanReverse);
      expect(result.reverseExpiresAt).toBe(deadline.toISOString());
    },
  );
});
