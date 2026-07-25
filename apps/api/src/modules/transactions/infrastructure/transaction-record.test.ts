import { describe, expect, it } from 'vitest';

import { transactionRecordSchema } from './transaction-record.ts';

const record = {
  id: 'txn-demo-001',
  accountId: 'acc_demo',
  merchantName: 'Northern Grocer',
  amount: { minorUnits: 100, currency: 'CAD' },
  status: 'posted',
  transactionDate: '2026-05-01T00:00:00.000Z',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  reversedAt: null,
};

describe('transactionRecordSchema identifiers', () => {
  it.each(['x', 'x'.repeat(128), 'acc_demo'])(
    'accepts account ID %j',
    (accountId) => {
      expect(
        transactionRecordSchema.parse({ ...record, accountId }).accountId,
      ).toBe(accountId);
    },
  );

  it.each(['x'.repeat(129), ' acc_demo', 'acc_demo ', '   '])(
    'rejects account ID %j',
    (accountId) => {
      expect(
        transactionRecordSchema.safeParse({ ...record, accountId }).success,
      ).toBe(false);
    },
  );

  it.each(['x', 'x'.repeat(64), 'txn-demo-001'])('accepts %j', (id) => {
    expect(transactionRecordSchema.parse({ ...record, id }).id).toBe(id);
  });

  it.each(['x'.repeat(65), ' txn-001', 'txn-001 '])('rejects %j', (id) => {
    expect(transactionRecordSchema.safeParse({ ...record, id }).success).toBe(
      false,
    );
  });
});
