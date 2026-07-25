import { describe, expect, it } from 'vitest';

import {
  listTransactionsPathParamsSchema,
  listTransactionsQuerySchema,
  listTransactionsResponseSchema,
} from './list-transactions.ts';

const transactionDto = {
  id: 'txn-001',
  accountId: 'account-001',
  merchantName: 'Northern Grocer',
  amount: {
    minorUnits: 2599,
    currency: 'CAD',
  },
  status: 'posted',
  transactionDate: '2026-07-20T18:30:00.000Z',
  createdAt: '2026-07-20T18:31:00.000Z',
  updatedAt: '2026-07-20T18:31:00.000Z',
  reversedAt: null,
  canReverse: true,
  reverseExpiresAt: '2026-08-20T18:30:00.000Z',
};

describe('listTransactionsPathParamsSchema', () => {
  it.each(['x', 'x'.repeat(128), 'acc_demo'])(
    'accepts a supported accountId without changing it',
    (accountId) => {
      const params = { accountId };

      expect(listTransactionsPathParamsSchema.parse(params)).toEqual(params);
    },
  );

  it.each(['', '   '])('rejects the invalid accountId %j', (accountId) => {
    expect(
      listTransactionsPathParamsSchema.safeParse({ accountId }).success,
    ).toBe(false);
  });

  it('rejects a missing accountId', () => {
    expect(listTransactionsPathParamsSchema.safeParse({}).success).toBe(false);
  });

  it.each([
    ['leading', ' account-001'],
    ['trailing', 'account-001 '],
    ['leading and trailing', ' account-001 '],
  ])('rejects %s whitespace', (_description, accountId) => {
    expect(
      listTransactionsPathParamsSchema.safeParse({ accountId }).success,
    ).toBe(false);
  });

  it.each(['a'.repeat(129), ' account-001', 'account-001 ', '   '])(
    'rejects the unsupported accountId %j',
    (accountId) => {
      expect(
        listTransactionsPathParamsSchema.safeParse({ accountId }).success,
      ).toBe(false);
    },
  );

  it('rejects undeclared path parameters', () => {
    expect(
      listTransactionsPathParamsSchema.safeParse({
        accountId: 'account-001',
        extra: 'not-allowed',
      }).success,
    ).toBe(false);
  });
});

describe('listTransactionsQuerySchema', () => {
  it('defaults pageSize to 20', () => {
    expect(listTransactionsQuerySchema.parse({})).toEqual({ pageSize: 20 });
  });

  it.each(['pending', 'posted', 'reversed'])(
    'accepts the status query value %s',
    (status) => {
      expect(listTransactionsQuerySchema.parse({ status })).toEqual({
        status,
        pageSize: 20,
      });
    },
  );

  it('rejects an invalid status query value', () => {
    expect(
      listTransactionsQuerySchema.safeParse({ status: 'declined' }).success,
    ).toBe(false);
  });

  it('accepts a numeric pageSize', () => {
    expect(listTransactionsQuerySchema.parse({ pageSize: 50 })).toEqual({
      pageSize: 50,
    });
  });

  it('accepts a valid numeric-string pageSize', () => {
    expect(listTransactionsQuerySchema.parse({ pageSize: '50' })).toEqual({
      pageSize: 50,
    });
  });

  it.each([
    ['zero', 0],
    ['a negative number', -1],
    ['a fractional number', 1.5],
    ['a number above 100', 101],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a non-numeric string', 'twenty'],
    ['a mixed numeric string', '20items'],
    ['an array', ['20']],
  ])('rejects %s as pageSize', (_description, pageSize) => {
    expect(listTransactionsQuerySchema.safeParse({ pageSize }).success).toBe(
      false,
    );
  });

  it('accepts an opaque pageToken', () => {
    const pageToken = 'opaque-cursor-value';

    expect(listTransactionsQuerySchema.parse({ pageToken })).toEqual({
      pageSize: 20,
      pageToken,
    });
  });

  it.each([
    ['an empty token', ''],
    ['a whitespace-only token', '   '],
    ['leading whitespace', ' opaque-cursor-value'],
    ['trailing whitespace', 'opaque-cursor-value '],
    ['leading and trailing whitespace', ' opaque-cursor-value '],
  ])('rejects pageToken with %s', (_description, pageToken) => {
    expect(listTransactionsQuerySchema.safeParse({ pageToken }).success).toBe(
      false,
    );
  });

  it('accepts a pageToken containing exactly 2048 characters', () => {
    const pageToken = 'a'.repeat(2048);

    expect(listTransactionsQuerySchema.parse({ pageToken })).toEqual({
      pageSize: 20,
      pageToken,
    });
  });

  it('rejects a pageToken longer than 2048 characters', () => {
    expect(
      listTransactionsQuerySchema.safeParse({
        pageToken: 'a'.repeat(2049),
      }).success,
    ).toBe(false);
  });

  it('rejects repeated pageToken values represented as an array', () => {
    expect(
      listTransactionsQuerySchema.safeParse({
        pageToken: ['cursor-one', 'cursor-two'],
      }).success,
    ).toBe(false);
  });

  it('accepts status, pageSize, and pageToken together', () => {
    expect(
      listTransactionsQuerySchema.parse({
        status: 'reversed',
        pageSize: '75',
        pageToken: 'opaque-cursor-value',
      }),
    ).toEqual({
      status: 'reversed',
      pageSize: 75,
      pageToken: 'opaque-cursor-value',
    });
  });

  it('rejects repeated status query values represented as an array', () => {
    expect(
      listTransactionsQuerySchema.safeParse({
        status: ['pending', 'posted'],
      }).success,
    ).toBe(false);
  });
});

describe('listTransactionsResponseSchema', () => {
  it('accepts a valid first-page response', () => {
    const response = {
      data: [transactionDto],
      meta: {
        pageSize: 20,
        returnedCount: 1,
        totalCount: 45,
        hasMore: true,
        nextPageToken: 'opaque-next-cursor',
      },
    };

    expect(listTransactionsResponseSchema.parse(response)).toEqual(response);
  });

  it('accepts a valid last-page response', () => {
    const response = {
      data: [transactionDto],
      meta: {
        pageSize: 20,
        returnedCount: 1,
        totalCount: 1,
        hasMore: false,
        nextPageToken: null,
      },
    };

    expect(listTransactionsResponseSchema.parse(response)).toEqual(response);
  });

  it('accepts a valid empty final page', () => {
    const response = {
      data: [],
      meta: {
        pageSize: 20,
        returnedCount: 0,
        totalCount: 0,
        hasMore: false,
        nextPageToken: null,
      },
    };

    expect(listTransactionsResponseSchema.parse(response)).toEqual(response);
  });

  it('accepts an empty later page while retaining the filtered totalCount', () => {
    const response = {
      data: [],
      meta: {
        pageSize: 20,
        returnedCount: 0,
        totalCount: 45,
        hasMore: false,
        nextPageToken: null,
      },
    };

    expect(listTransactionsResponseSchema.parse(response)).toEqual(response);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid totalCount %j',
    (totalCount) => {
      expect(
        listTransactionsResponseSchema.safeParse({
          data: [],
          meta: {
            pageSize: 20,
            returnedCount: 0,
            totalCount,
            hasMore: false,
            nextPageToken: null,
          },
        }).success,
      ).toBe(false);
    },
  );

  it('rejects a response missing totalCount', () => {
    expect(
      listTransactionsResponseSchema.safeParse({
        data: [],
        meta: {
          pageSize: 20,
          returnedCount: 0,
          hasMore: false,
          nextPageToken: null,
        },
      }).success,
    ).toBe(false);
  });

  it('rejects returnedCount greater than totalCount', () => {
    expect(
      listTransactionsResponseSchema.safeParse({
        data: [transactionDto],
        meta: {
          pageSize: 20,
          returnedCount: 1,
          totalCount: 0,
          hasMore: false,
          nextPageToken: null,
        },
      }).success,
    ).toBe(false);
  });

  it('rejects an empty page that claims another page exists', () => {
    expect(
      listTransactionsResponseSchema.safeParse({
        data: [],
        meta: {
          pageSize: 20,
          returnedCount: 0,
          totalCount: 0,
          hasMore: true,
          nextPageToken: 'unexpected-next-cursor',
        },
      }).success,
    ).toBe(false);
  });

  it('rejects returnedCount that differs from data.length', () => {
    expect(
      listTransactionsResponseSchema.safeParse({
        data: [transactionDto],
        meta: {
          pageSize: 20,
          returnedCount: 0,
          totalCount: 1,
          hasMore: false,
          nextPageToken: null,
        },
      }).success,
    ).toBe(false);
  });

  it('rejects returnedCount greater than pageSize', () => {
    expect(
      listTransactionsResponseSchema.safeParse({
        data: [transactionDto, transactionDto],
        meta: {
          pageSize: 1,
          returnedCount: 2,
          totalCount: 2,
          hasMore: false,
          nextPageToken: null,
        },
      }).success,
    ).toBe(false);
  });

  it('rejects hasMore true without a nextPageToken', () => {
    expect(
      listTransactionsResponseSchema.safeParse({
        data: [transactionDto],
        meta: {
          pageSize: 20,
          returnedCount: 1,
          totalCount: 1,
          hasMore: true,
          nextPageToken: null,
        },
      }).success,
    ).toBe(false);
  });

  it('rejects hasMore true with a blank nextPageToken', () => {
    expect(
      listTransactionsResponseSchema.safeParse({
        data: [transactionDto],
        meta: {
          pageSize: 20,
          returnedCount: 1,
          totalCount: 1,
          hasMore: true,
          nextPageToken: '   ',
        },
      }).success,
    ).toBe(false);
  });

  it('rejects hasMore false with a nextPageToken', () => {
    expect(
      listTransactionsResponseSchema.safeParse({
        data: [transactionDto],
        meta: {
          pageSize: 20,
          returnedCount: 1,
          totalCount: 1,
          hasMore: false,
          nextPageToken: 'unexpected-cursor',
        },
      }).success,
    ).toBe(false);
  });
});
