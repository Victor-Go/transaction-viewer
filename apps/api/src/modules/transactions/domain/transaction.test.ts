import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_ID_MAX_LENGTH,
  TRANSACTION_ID_MAX_LENGTH,
  isValidAccountId,
  isValidTransactionId,
} from './transaction.ts';

describe('account ID invariant', () => {
  it.each(['x', 'x'.repeat(128), 'acc_demo'])(
    'accepts supported ID %j',
    (id) => {
      expect(isValidAccountId(id)).toBe(true);
    },
  );

  it.each(['', 'x'.repeat(129), ' account-001', 'account-001 ', '   '])(
    'rejects unsupported ID %j',
    (id) => {
      expect(isValidAccountId(id)).toBe(false);
    },
  );

  it('publishes the 128-character maximum', () => {
    expect(ACCOUNT_ID_MAX_LENGTH).toBe(128);
  });
});

describe('transaction ID invariant', () => {
  it.each(['x', 'x'.repeat(64), 'txn-demo-001'])(
    'accepts supported ID %j',
    (id) => {
      expect(isValidTransactionId(id)).toBe(true);
    },
  );

  it.each(['', 'x'.repeat(65), ' txn-001', 'txn-001 '])(
    'rejects unsupported ID %j',
    (id) => {
      expect(isValidTransactionId(id)).toBe(false);
    },
  );

  it('publishes the 64-character maximum', () => {
    expect(TRANSACTION_ID_MAX_LENGTH).toBe(64);
  });
});
