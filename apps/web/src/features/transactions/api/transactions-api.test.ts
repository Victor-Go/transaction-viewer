import {
  createTransactionRequestSchema,
  type TransactionDto,
} from '@card-platform/contracts';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../test/server';
import {
  createTransaction,
  getTransaction,
  listTransactions,
  reverseTransaction,
} from './transactions-api';

const posted: TransactionDto = {
  id: 'txn/one',
  accountId: 'account one',
  merchantName: 'Northern Grocer',
  amount: { minorUnits: 2599, currency: 'CAD' },
  status: 'posted',
  transactionDate: '2026-07-20T18:30:00.000Z',
  createdAt: '2026-07-20T18:30:00.000Z',
  updatedAt: '2026-07-20T18:30:00.000Z',
  reversedAt: null,
  canReverse: true,
  reverseExpiresAt: '2026-08-20T18:30:00.000Z',
};

describe('Transaction API adapter', () => {
  it('encodes path segments and preserves an opaque cursor unchanged', async () => {
    const cursor = 'opaque/+== cursor';
    let requestedUrl = '';
    server.use(
      http.get('/api/v1/accounts/account%20one/transactions', ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json({
          data: [posted],
          meta: {
            pageSize: 20,
            returnedCount: 1,
            totalCount: 1,
            hasMore: false,
            nextPageToken: null,
          },
        });
      }),
      http.get('/api/v1/accounts/account%20one/transactions/txn%2Fone', () =>
        HttpResponse.json({ data: posted }),
      ),
    );

    await listTransactions('account one', {
      pageSize: 20,
      status: 'posted',
      pageToken: cursor,
      from: '2026-07-01T07:00:00.000Z',
      to: '2026-08-01T07:00:00.000Z',
    });
    await getTransaction('account one', 'txn/one');

    const url = new URL(requestedUrl);
    expect(url.searchParams.get('pageToken')).toBe(cursor);
    expect(url.searchParams.get('status')).toBe('posted');
    expect(url.searchParams.get('from')).toBe('2026-07-01T07:00:00.000Z');
    expect(url.searchParams.get('to')).toBe('2026-08-01T07:00:00.000Z');
  });

  it('sends the strict create body and exactly one Idempotency-Key header', async () => {
    const body = createTransactionRequestSchema.parse({
      merchantName: 'Northern Grocer',
      amount: { minorUnits: 2599, currency: 'CAD' },
    });
    let receivedBody: unknown;
    server.use(
      http.post(
        '/api/v1/accounts/account%20one/transactions',
        async ({ request }) => {
          receivedBody = await request.json();
          expect(request.headers.get('Idempotency-Key')).toBe('create-key');
          return HttpResponse.json(
            { data: { ...posted, status: 'pending', canReverse: false } },
            { status: 201 },
          );
        },
      ),
    );

    await createTransaction('account one', body, 'create-key');

    expect(receivedBody).toEqual(body);
  });

  it('posts an empty reversal body with one Idempotency-Key value', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(
        '/api/v1/accounts/account%20one/transactions/txn%2Fone/reversal',
        async ({ request }) => {
          receivedBody = await request.json();
          expect(request.headers.get('Idempotency-Key')).toBe('reverse-key');
          return HttpResponse.json({
            data: {
              ...posted,
              status: 'reversed',
              reversedAt: '2026-07-21T00:00:00.000Z',
              canReverse: false,
            },
          });
        },
      ),
    );

    await reverseTransaction('account one', 'txn/one', 'reverse-key');

    expect(receivedBody).toEqual({});
  });
});
