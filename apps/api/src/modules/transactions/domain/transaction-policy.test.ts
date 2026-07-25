import { describe, expect, it } from 'vitest';

import type { Transaction } from './transaction.ts';
import {
  ALLOWED_TRANSACTION_STATUS_TRANSITIONS,
  PENDING_POST_DELAY_MILLISECONDS,
  REVERSAL_WINDOW_MILLISECONDS,
  UnsupportedTransactionStatusTransitionError,
  TransactionAlreadyReversedError,
  TransactionNotPostedError,
  ReversalWindowExpiredError,
  assertTransactionStatusTransition,
  canTransitionTransactionStatus,
  canReverseTransaction,
  getReverseExpiresAt,
  isPendingPostingEligible,
  postPendingTransaction,
  reversePostedTransaction,
} from './transaction-policy.ts';

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
    ? {
        ...common,
        status,
        reversedAt: new Date('2026-05-02T00:00:00.000Z'),
      }
    : { ...common, status, reversedAt: null };
};

describe('transaction reversal policy', () => {
  const posted = transaction('posted');
  const deadline = new Date(
    posted.transactionDate.valueOf() + 31 * 24 * 60 * 60 * 1000,
  );

  it('uses an exact rolling 31-day deadline', () => {
    expect(REVERSAL_WINDOW_MILLISECONDS).toBe(31 * 24 * 60 * 60 * 1000);
    expect(getReverseExpiresAt(posted.transactionDate)).toEqual(deadline);
  });

  it.each([
    ['pending', false],
    ['posted', true],
    ['reversed', false],
  ] as const)(
    'projects %s eligibility within the window',
    (status, expected) => {
      expect(
        canReverseTransaction(
          transaction(status),
          new Date('2026-05-02T00:00:00.000Z'),
        ),
      ).toBe(expected);
    },
  );

  it('allows reversal exactly at the deadline and rejects one millisecond later', () => {
    const reversed = reversePostedTransaction(posted, deadline);
    expect(reversed).toMatchObject({
      status: 'reversed',
      updatedAt: deadline,
      reversedAt: deadline,
    });
    expect(canReverseTransaction(posted, deadline)).toBe(true);
    expect(
      canReverseTransaction(posted, new Date(deadline.valueOf() + 1)),
    ).toBe(false);
    expect(() =>
      reversePostedTransaction(posted, new Date(deadline.valueOf() + 1)),
    ).toThrow(ReversalWindowExpiredError);
  });

  it('rejects pending and already reversed transactions distinctly', () => {
    expect(() =>
      reversePostedTransaction(transaction('pending'), deadline),
    ).toThrow(TransactionNotPostedError);
    expect(() =>
      reversePostedTransaction(transaction('reversed'), deadline),
    ).toThrow(TransactionAlreadyReversedError);
  });
});

describe('transaction status state machine', () => {
  it('declares the complete allowed-transition table', () => {
    expect(ALLOWED_TRANSACTION_STATUS_TRANSITIONS).toEqual({
      pending: ['posted'],
      posted: ['reversed'],
      reversed: [],
    });
  });

  it.each([
    ['pending', 'posted', true],
    ['posted', 'reversed', true],
    ['pending', 'reversed', false],
    ['posted', 'pending', false],
    ['reversed', 'posted', false],
    ['reversed', 'pending', false],
    ['reversed', 'reversed', false],
  ] as const)(
    'reports %s → %s structural permission as %s',
    (fromStatus, toStatus, expected) => {
      expect(canTransitionTransactionStatus(fromStatus, toStatus)).toBe(
        expected,
      );
    },
  );

  it('asserts unsupported internal transitions with a Domain error', () => {
    expect(() =>
      assertTransactionStatusTransition('pending', 'reversed'),
    ).toThrow(UnsupportedTransactionStatusTransitionError);
    expect(() =>
      assertTransactionStatusTransition('pending', 'posted'),
    ).not.toThrow();
  });
});

describe('pending posting policy', () => {
  const executionTime = new Date('2026-05-01T00:00:05.000Z');

  it('posts pending transactions at exactly five seconds and preserves others', () => {
    expect(PENDING_POST_DELAY_MILLISECONDS).toBe(5000);
    const pending = transaction('pending');
    expect(
      isPendingPostingEligible(pending, new Date(executionTime.valueOf() - 1)),
    ).toBe(false);
    expect(isPendingPostingEligible(pending, executionTime)).toBe(true);

    const posted = postPendingTransaction(pending, executionTime);
    expect(posted).toMatchObject({
      status: 'posted',
      updatedAt: executionTime,
      reversedAt: null,
    });
    expect(isPendingPostingEligible(transaction('posted'), executionTime)).toBe(
      false,
    );
    expect(
      isPendingPostingEligible(transaction('reversed'), executionTime),
    ).toBe(false);
  });
});
