import type {
  TransactionDto,
  TransactionStatus,
} from '@card-platform/contracts';
import { CalendarDate } from '@internationalized/date';
import { describe, expect, it } from 'vitest';

import {
  appendTransactionPage,
  matchesActiveQuery,
  prependCreatedTransaction,
  reconcileStatusTransition,
  updateLoadedTransaction,
} from './transaction-list-state';

const transaction = (
  id: string,
  status: TransactionStatus,
  transactionDate = '2026-07-20T18:30:00.000Z',
): TransactionDto => {
  const common = {
    id,
    accountId: 'acc_demo',
    merchantName: `Merchant ${id}`,
    amount: { minorUnits: 2599, currency: 'CAD' as const },
    transactionDate,
    createdAt: transactionDate,
    updatedAt: transactionDate,
    canReverse: status === 'posted',
    reverseExpiresAt: '2026-08-20T18:30:00.000Z',
  };
  return status === 'reversed'
    ? { ...common, status, reversedAt: transactionDate }
    : { ...common, status, reversedAt: null };
};

describe('appendTransactionPage', () => {
  it('preserves server order and defensively deduplicates IDs', () => {
    expect(
      appendTransactionPage(
        [transaction('one', 'pending')],
        [transaction('one', 'posted'), transaction('two', 'posted')],
      ).map(({ id }) => id),
    ).toEqual(['one', 'two']);
  });
});

describe('transaction list reconciliation provenance', () => {
  const all = {
    status: null,
    dateRange: null,
    timeZone: 'America/Los_Angeles',
  } as const;
  const posted = { ...all, status: 'posted' } as const;
  const july20 = {
    ...all,
    dateRange: {
      start: new CalendarDate(2026, 7, 20),
      end: new CalendarDate(2026, 7, 20),
    },
  } as const;
  const postedJuly20 = { ...july20, status: 'posted' } as const;

  it.each([
    ['All without a date', transaction('one', 'pending'), all, true],
    ['Posted without a date', transaction('one', 'pending'), posted, false],
    [
      'All inside a date',
      transaction('one', 'pending', '2026-07-20T07:00:00.000Z'),
      july20,
      true,
    ],
    [
      'All before a date',
      transaction('one', 'posted', '2026-07-20T06:59:59.999Z'),
      july20,
      false,
    ],
    [
      'Posted at the exclusive end',
      transaction('one', 'posted', '2026-07-21T07:00:00.000Z'),
      postedJuly20,
      false,
    ],
    [
      'invalid Transaction date',
      transaction('one', 'posted', 'not-a-date'),
      postedJuly20,
      false,
    ],
  ])(
    '%s has deterministic complete-query membership',
    (_name, item, query, expected) => {
      expect(matchesActiveQuery(item, query)).toBe(expected);
    },
  );

  it('updates an All-filter item in place without changing the total', () => {
    const result = updateLoadedTransaction(
      {
        items: [transaction('one', 'pending')],
        totalCount: 1,
      },
      transaction('one', 'posted'),
    );

    expect(result.items[0]?.status).toBe('posted');
    expect(result.totalCount).toBe(1);
  });

  it('does not insert an existing but unloaded Detail or change totalCount', () => {
    const initial = {
      items: Array.from({ length: 20 }, (_, index) =>
        transaction(`loaded-${index}`, 'posted'),
      ),
      totalCount: 45,
    };

    expect(
      updateLoadedTransaction(initial, transaction('unloaded', 'posted')),
    ).toBe(initial);
  });

  it('removes a loaded item that leaves the active status filter', () => {
    const result = reconcileStatusTransition(
      {
        items: [transaction('one', 'pending')],
        totalCount: 1,
      },
      transaction('one', 'pending'),
      transaction('one', 'posted'),
      { ...all, status: 'pending' },
    );

    expect(result).toEqual({ items: [], totalCount: 0 });
  });

  it('prepends a confirmed creation exactly once when it belongs', () => {
    const updated = transaction('newer', 'posted', '2026-07-21T18:30:00.000Z');
    const initial = {
      items: [transaction('older', 'posted')],
      totalCount: 1,
    };

    const once = prependCreatedTransaction(initial, updated, posted);
    const twice = prependCreatedTransaction(once, updated, posted);

    expect(twice.items.map(({ id }) => id)).toEqual(['newer', 'older']);
    expect(twice.totalCount).toBe(2);
  });

  it('adds a known status transition only when old membership was absent and new membership is present', () => {
    const initial = {
      items: [transaction('other', 'posted')],
      totalCount: 10,
    };
    const result = reconcileStatusTransition(
      initial,
      transaction('transitioned', 'pending'),
      transaction('transitioned', 'posted'),
      posted,
    );

    expect(result.items.map(({ id }) => id)).toEqual(['transitioned', 'other']);
    expect(result.totalCount).toBe(11);
  });

  it('does not insert or count a confirmed creation outside the active range', () => {
    const initial = {
      items: [transaction('inside', 'posted')],
      totalCount: 1,
    };

    expect(
      prependCreatedTransaction(
        initial,
        transaction('outside', 'posted', '2026-07-19T18:30:00.000Z'),
        postedJuly20,
      ),
    ).toBe(initial);
  });

  it('counts a Pending-to-Posted transition inside the active range once', () => {
    const initial = { items: [], totalCount: 0 };
    const previous = transaction('one', 'pending');
    const next = transaction('one', 'posted');

    const once = reconcileStatusTransition(
      initial,
      previous,
      next,
      postedJuly20,
    );
    const twice = reconcileStatusTransition(once, previous, next, postedJuly20);

    expect(once.items).toHaveLength(1);
    expect(once.totalCount).toBe(1);
    expect(twice.items).toHaveLength(1);
    expect(twice.totalCount).toBe(1);
  });

  it.each([
    ['Posted', postedJuly20, 0],
    ['Reversed', { ...july20, status: 'reversed' } as const, 1],
  ])(
    'reconciles a reverse under the %s full query',
    (_name, query, expectedTotal) => {
      const previous = transaction('one', 'posted');
      const next = transaction('one', 'reversed');
      const initial = { items: [previous], totalCount: 1 };

      expect(
        reconcileStatusTransition(initial, previous, next, query).totalCount,
      ).toBe(expectedTotal);
    },
  );
});
