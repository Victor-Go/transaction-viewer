import type { TransactionDto } from '@card-platform/contracts';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../test/server';
import { App } from './App';

vi.mock('@internationalized/date', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@internationalized/date')>();
  return {
    ...actual,
    today: () => actual.parseDate('2026-07-27'),
  };
});

const deferred = () => {
  let resolve: (() => void) | undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return {
    promise,
    resolve: () => {
      if (resolve === undefined)
        throw new Error('Deferred was not initialized');
      resolve();
    },
  };
};

const getDateButton = (date: string): HTMLButtonElement => {
  const element = document.querySelector<HTMLButtonElement>(
    `[data-date="${date}"]`,
  );
  if (element === null) throw new Error(`Date button ${date} was not rendered`);
  return element;
};

const transaction = (
  status: TransactionDto['status'] = 'posted',
): TransactionDto => {
  const common = {
    id: 'txn-001',
    accountId: 'acc_demo',
    merchantName: 'Northern Grocer',
    amount: { minorUnits: 2599, currency: 'CAD' as const },
    transactionDate: '2026-07-20T18:30:00.000Z',
    createdAt: '2026-07-20T18:30:00.000Z',
    updatedAt: '2026-07-20T18:30:00.000Z',
    canReverse: status === 'posted',
    reverseExpiresAt: '2099-08-20T18:30:00.000Z',
  };
  return status === 'reversed'
    ? {
        ...common,
        status,
        reversedAt: '2026-07-21T18:30:00.000Z',
      }
    : { ...common, status, reversedAt: null };
};

const listResponse = (data: TransactionDto[] = [transaction()]) => ({
  data,
  meta: {
    pageSize: 20,
    returnedCount: data.length,
    totalCount: data.length,
    hasMore: false,
    nextPageToken: null,
  },
});

describe('App', () => {
  it('redirects to and renders Transaction History through the real API adapter', async () => {
    let requestedUrl: URL | null = null;
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', ({ request }) => {
        requestedUrl = new URL(request.url);
        return HttpResponse.json(listResponse());
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Transaction history' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Northern Grocer')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/accounts/acc_demo/transactions');
    expect(window.location.search).toBe('');
    expect(requestedUrl!.searchParams.get('from')).toBeNull();
    expect(requestedUrl!.searchParams.get('to')).toBeNull();
  });

  it('keeps History rendered behind a directly loaded route-driven Detail overlay', async () => {
    window.history.replaceState(
      {},
      '',
      '/accounts/acc_demo/transactions/txn-001',
    );
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', () =>
        HttpResponse.json(listResponse()),
      ),
      http.get('/api/v1/accounts/acc_demo/transactions/txn-001', () =>
        HttpResponse.json({ data: transaction() }),
      ),
    );

    render(<App />);

    expect(
      await screen.findByRole('dialog', { name: 'Transaction details' }),
    ).toBeInTheDocument();
    expect(document.querySelector('h1')).toHaveTextContent(
      'Transaction history',
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Close details' }),
    );

    await waitFor(() =>
      expect(window.location.pathname).toBe('/accounts/acc_demo/transactions'),
    );
  });

  it('follows route identity and ignores a late response for the previous transaction', async () => {
    window.history.replaceState(
      {},
      '',
      '/accounts/acc_demo/transactions/txn-001',
    );
    const second = {
      ...transaction(),
      id: 'txn-002',
      merchantName: 'Second Merchant',
    };
    const firstMayRespond = deferred();
    const firstResponded = deferred();
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', () =>
        HttpResponse.json(listResponse([transaction(), second])),
      ),
      http.get('/api/v1/accounts/acc_demo/transactions/txn-001', async () => {
        await firstMayRespond.promise;
        firstResponded.resolve();
        return HttpResponse.json({ data: transaction() });
      }),
      http.get('/api/v1/accounts/acc_demo/transactions/txn-002', () =>
        HttpResponse.json({ data: second }),
      ),
    );

    render(<App />);
    expect(
      await screen.findByRole('dialog', { name: 'Transaction details' }),
    ).toBeInTheDocument();

    act(() => {
      window.history.pushState(
        {},
        '',
        '/accounts/acc_demo/transactions/txn-002',
      );
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    const currentDialog = await screen.findByRole('dialog', {
      name: 'Transaction details',
    });
    expect(
      await within(currentDialog).findByText('Second Merchant'),
    ).toBeInTheDocument();
    await act(async () => {
      firstMayRespond.resolve();
      await firstResponded.promise;
    });
    expect(
      within(currentDialog).queryByText('Northern Grocer'),
    ).not.toBeInTheDocument();
  });

  it('removes descendant confirmations when their route-owned Detail unmounts', async () => {
    window.history.replaceState(
      {},
      '',
      '/accounts/acc_demo/transactions/txn-001',
    );
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', () =>
        HttpResponse.json(listResponse()),
      ),
      http.get('/api/v1/accounts/acc_demo/transactions/txn-001', () =>
        HttpResponse.json({ data: transaction() }),
      ),
    );
    render(<App />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Reverse transaction' }),
    );
    expect(
      screen.getByRole('alertdialog', { name: 'Reverse this transaction?' }),
    ).toBeInTheDocument();

    act(() => {
      window.history.pushState({}, '', '/accounts/acc_demo/transactions');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await waitFor(() =>
      expect(
        screen.queryByRole('alertdialog', {
          name: 'Reverse this transaction?',
        }),
      ).not.toBeInTheDocument(),
    );
  });

  it('opens Create programmatically and reports field validation errors', async () => {
    window.history.replaceState({}, '', '/accounts/acc_demo/transactions');
    let createRequests = 0;
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', () =>
        HttpResponse.json(listResponse([])),
      ),
      http.post('/api/v1/accounts/acc_demo/transactions', () => {
        createRequests += 1;
        return HttpResponse.json(
          { data: transaction('pending') },
          { status: 201 },
        );
      }),
    );
    render(<App />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Create transaction' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Create transaction' }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Create purchase' }),
    );

    expect(screen.getByText('Enter a merchant name.')).toBeInTheDocument();
    expect(
      screen.getByText('Enter a CAD amount from $0.01 to $999,999,999.99.'),
    ).toBeInTheDocument();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Merchant name' }),
      'Northern Grocer',
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Amount (CAD)' }), {
      target: { value: '1000000000.00' },
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Create purchase' }),
    );

    expect(
      screen.getByText('Enter a CAD amount from $0.01 to $999,999,999.99.'),
    ).toBeInTheDocument();
    expect(createRequests).toBe(0);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Create transaction' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('opens an AlertDialog above Detail and one Escape closes only confirmation', async () => {
    window.history.replaceState(
      {},
      '',
      '/accounts/acc_demo/transactions/txn-001',
    );
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', () =>
        HttpResponse.json(listResponse()),
      ),
      http.get('/api/v1/accounts/acc_demo/transactions/txn-001', () =>
        HttpResponse.json({ data: transaction() }),
      ),
    );
    render(<App />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Reverse transaction' }),
    );
    expect(
      screen.getByRole('alertdialog', { name: 'Reverse this transaction?' }),
    ).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(
      screen.queryByRole('alertdialog', { name: 'Reverse this transaction?' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: 'Transaction details' }),
    ).toBeInTheDocument();
  });

  it('synchronizes server-side filtering and opaque keyset pagination', async () => {
    window.history.replaceState({}, '', '/accounts/acc_demo/transactions');
    const seenCursors: (string | null)[] = [];
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', ({ request }) => {
        const url = new URL(request.url);
        const status = url.searchParams.get('status');
        const cursor = url.searchParams.get('pageToken');
        seenCursors.push(cursor);
        if (status === 'posted' && cursor === 'opaque/+== cursor') {
          return HttpResponse.json(
            listResponse([
              {
                ...transaction(),
                id: 'txn-002',
                merchantName: 'Second Merchant',
              },
            ]),
          );
        }
        if (status === 'posted') {
          return HttpResponse.json({
            data: [transaction()],
            meta: {
              pageSize: 20,
              returnedCount: 1,
              totalCount: 2,
              hasMore: true,
              nextPageToken: 'opaque/+== cursor',
            },
          });
        }
        return HttpResponse.json(listResponse([]));
      }),
    );
    render(<App />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Posted' }),
    );
    expect(await screen.findByText('Northern Grocer')).toBeInTheDocument();
    expect(window.location.search).toBe('?status=posted');

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Second Merchant')).toBeInTheDocument();
    expect(seenCursors).toContain('opaque/+== cursor');
  });

  it('creates an exact-minor-unit purchase with a frontend idempotency key', async () => {
    window.history.replaceState({}, '', '/accounts/acc_demo/transactions');
    const pending = transaction('pending');
    let body: unknown;
    let idempotencyKey: string | null = null;
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', () =>
        HttpResponse.json(listResponse([])),
      ),
      http.post(
        '/api/v1/accounts/acc_demo/transactions',
        async ({ request }) => {
          body = await request.json();
          idempotencyKey = request.headers.get('Idempotency-Key');
          return HttpResponse.json({ data: pending }, { status: 201 });
        },
      ),
      http.get('/api/v1/accounts/acc_demo/transactions/txn-001', () =>
        HttpResponse.json({ data: pending }),
      ),
    );
    render(<App />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Create transaction' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Merchant name' }),
      'Northern Grocer',
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Amount (CAD)' }),
      '25,99',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Create purchase' }),
    );

    expect(
      await screen.findByRole('dialog', { name: 'Transaction details' }),
    ).toBeInTheDocument();
    expect(body).toEqual({
      merchantName: 'Northern Grocer',
      amount: { minorUnits: 2599, currency: 'CAD' },
    });
    expect(idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(window.location.pathname).toBe(
      '/accounts/acc_demo/transactions/txn-001',
    );
    expect(
      await screen.findByText(/New transactions begin as Pending/),
    ).toBeInTheDocument();
  });

  it('reuses the same create key when a network outcome is uncertain', async () => {
    window.history.replaceState({}, '', '/accounts/acc_demo/transactions');
    const pending = transaction('pending');
    const keys: string[] = [];
    let attempt = 0;
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', () =>
        HttpResponse.json(listResponse([])),
      ),
      http.post('/api/v1/accounts/acc_demo/transactions', ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key') ?? '');
        attempt += 1;
        return attempt === 1
          ? HttpResponse.error()
          : HttpResponse.json({ data: pending }, { status: 201 });
      }),
      http.get('/api/v1/accounts/acc_demo/transactions/txn-001', () =>
        HttpResponse.json({ data: pending }),
      ),
    );
    render(<App />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Create transaction' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Merchant name' }),
      'Northern Grocer',
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Amount (CAD)' }),
      '25.99',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Create purchase' }),
    );
    expect(await screen.findByText(/result is uncertain/i)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Create purchase' }),
    );

    await screen.findByRole('dialog', { name: 'Transaction details' });
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it('reuses the same create key when a successful response violates its contract', async () => {
    window.history.replaceState({}, '', '/accounts/acc_demo/transactions');
    const pending = transaction('pending');
    const keys: string[] = [];
    let attempt = 0;
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', () =>
        HttpResponse.json(listResponse([])),
      ),
      http.post('/api/v1/accounts/acc_demo/transactions', ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key') ?? '');
        attempt += 1;
        return attempt === 1
          ? HttpResponse.json({ data: { invalid: true } }, { status: 201 })
          : HttpResponse.json({ data: pending }, { status: 201 });
      }),
      http.get('/api/v1/accounts/acc_demo/transactions/txn-001', () =>
        HttpResponse.json({ data: pending }),
      ),
    );
    render(<App />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Create transaction' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Merchant name' }),
      'Northern Grocer',
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Amount (CAD)' }),
      '25.99',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Create purchase' }),
    );
    expect(await screen.findByText(/result is uncertain/i)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Create purchase' }),
    );
    await screen.findByRole('dialog', { name: 'Transaction details' });

    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it('preserves the complete History query while opening and closing Detail', async () => {
    const search =
      '?status=posted&fromDate=2026-04-01&toDate=2026-07-24&future=value';
    window.history.replaceState(
      {},
      '',
      `/accounts/acc_demo/transactions${search}`,
    );
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', () =>
        HttpResponse.json(listResponse()),
      ),
      http.get('/api/v1/accounts/acc_demo/transactions/txn-001', () =>
        HttpResponse.json({ data: transaction() }),
      ),
    );
    render(<App />);

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'View details for Northern Grocer',
      }),
    );
    expect(window.location.pathname).toBe(
      '/accounts/acc_demo/transactions/txn-001',
    );
    expect(window.location.search).toBe(search);

    await userEvent.click(
      screen.getByRole('button', { name: 'Close details' }),
    );
    await waitFor(() =>
      expect(window.location.pathname).toBe('/accounts/acc_demo/transactions'),
    );
    expect(window.location.search).toBe(search);
  });

  it('reverses without an optimistic update and keeps Detail open', async () => {
    window.history.replaceState(
      {},
      '',
      '/accounts/acc_demo/transactions/txn-001',
    );
    const posted = transaction();
    const reversed = transaction('reversed');
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', () =>
        HttpResponse.json(listResponse([posted])),
      ),
      http.get('/api/v1/accounts/acc_demo/transactions/txn-001', () =>
        HttpResponse.json({ data: posted }),
      ),
      http.post('/api/v1/accounts/acc_demo/transactions/txn-001/reversal', () =>
        HttpResponse.json({ data: reversed }),
      ),
    );
    render(<App />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Reverse transaction' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Reverse transaction' }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('alertdialog', {
          name: 'Reverse this transaction?',
        }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('dialog', { name: 'Transaction details' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('This transaction has already been reversed.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reverse transaction' }),
    ).not.toBeInTheDocument();
  });

  it('reuses the same reversal key after a malformed successful response', async () => {
    window.history.replaceState(
      {},
      '',
      '/accounts/acc_demo/transactions/txn-001',
    );
    const posted = transaction();
    const reversed = transaction('reversed');
    const keys: string[] = [];
    let attempt = 0;
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', () =>
        HttpResponse.json(listResponse([posted])),
      ),
      http.get('/api/v1/accounts/acc_demo/transactions/txn-001', () =>
        HttpResponse.json({ data: posted }),
      ),
      http.post(
        '/api/v1/accounts/acc_demo/transactions/txn-001/reversal',
        ({ request }) => {
          keys.push(request.headers.get('Idempotency-Key') ?? '');
          attempt += 1;
          return attempt === 1
            ? HttpResponse.json({ data: { invalid: true } })
            : HttpResponse.json({ data: reversed });
        },
      ),
    );
    render(<App />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Reverse transaction' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Reverse transaction' }),
    );
    expect(await screen.findByText(/result is uncertain/i)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Reverse transaction' }),
    );

    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it('keeps date draft changes local and applies one first-page request with status', async () => {
    window.history.replaceState(
      {},
      '',
      '/accounts/acc_demo/transactions?status=posted',
    );
    const requests: URL[] = [];
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json(listResponse());
      }),
    );
    render(<App />);
    await screen.findByText('Northern Grocer');
    expect(requests).toHaveLength(1);

    await userEvent.click(
      screen.getByRole('button', { name: 'Search by date' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Search transactions by date' }),
    ).toBeInTheDocument();
    expect(requests).toHaveLength(1);
    expect(document.querySelectorAll('[data-selected]')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByText('Select a start date')).toBeInTheDocument();
    expect(screen.getByText('Select an end date')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Previous month' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Previous year' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Next year' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(requests).toHaveLength(1);

    await userEvent.click(getDateButton('2026-07-20'));
    expect(requests).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(getDateButton('2026-07-21'));
    expect(requests).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(requests).toHaveLength(2));
    expect(window.location.search).toContain('status=posted');
    expect(window.location.search).toContain('fromDate=2026-07-20');
    expect(window.location.search).toContain('toDate=2026-07-21');
    expect(requests[1]?.searchParams.get('status')).toBe('posted');
    expect(requests[1]?.searchParams.get('from')).toMatch(/Z$/);
    expect(requests[1]?.searchParams.get('to')).toMatch(/Z$/);
    expect(requests[1]?.searchParams.get('pageToken')).toBeNull();
    expect(
      screen.getByRole('button', {
        name: 'Edit date search: Jul 20 – 21',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Clear date search: Jul 20 – 21',
      }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reversed' }));
    await waitFor(() => expect(requests).toHaveLength(3));
    expect(window.location.search).toContain('status=reversed');
    expect(window.location.search).toContain('fromDate=2026-07-20');
    expect(window.location.search).toContain('toDate=2026-07-21');
    expect(requests[2]?.searchParams.get('pageToken')).toBeNull();
  });

  it('cancels a date draft without changing URL or querying', async () => {
    window.history.replaceState({}, '', '/accounts/acc_demo/transactions');
    let requests = 0;
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', () => {
        requests += 1;
        return HttpResponse.json(listResponse());
      }),
    );
    render(<App />);
    await screen.findByText('Northern Grocer');

    await userEvent.click(
      screen.getByRole('button', { name: 'Search by date' }),
    );
    await userEvent.click(getDateButton('2026-07-20'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(window.location.search).toBe('');
    expect(requests).toBe(1);
    expect(
      screen.getByRole('button', { name: 'Search by date' }),
    ).toHaveFocus();
  });

  it('discards a date draft after Escape', async () => {
    window.history.replaceState({}, '', '/accounts/acc_demo/transactions');
    let requests = 0;
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', () => {
        requests += 1;
        return HttpResponse.json(listResponse());
      }),
    );
    render(<App />);
    await screen.findByText('Northern Grocer');

    await userEvent.click(
      screen.getByRole('button', { name: 'Search by date' }),
    );
    await userEvent.click(getDateButton('2026-07-20'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', {
          name: 'Search transactions by date',
        }),
      ).not.toBeInTheDocument(),
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Search by date' }),
    );
    expect(document.querySelectorAll('[data-selected]')).toHaveLength(0);
    expect(window.location.search).toBe('');
    expect(requests).toBe(1);
  });

  it('clears an applied date search once, preserves status, and drops its cursor', async () => {
    window.history.replaceState(
      {},
      '',
      '/accounts/acc_demo/transactions?status=posted&fromDate=2026-07-20&toDate=2026-07-21',
    );
    const requests: URL[] = [];
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', ({ request }) => {
        const url = new URL(request.url);
        requests.push(url);
        if (url.searchParams.has('pageToken')) {
          return HttpResponse.json(listResponse([]));
        }
        if (url.searchParams.has('from')) {
          return HttpResponse.json({
            ...listResponse(),
            meta: {
              ...listResponse().meta,
              totalCount: 2,
              hasMore: true,
              nextPageToken: 'date-scoped-cursor',
            },
          });
        }
        return HttpResponse.json(listResponse());
      }),
    );
    render(<App />);
    await screen.findByText('Northern Grocer');

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(requests).toHaveLength(2));
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Clear date search: Jul 20 – 21',
      }),
    );

    await waitFor(() => expect(requests).toHaveLength(3));
    expect(window.location.search).toBe('?status=posted');
    expect(requests[2]?.searchParams.get('status')).toBe('posted');
    expect(requests[2]?.searchParams.get('from')).toBeNull();
    expect(requests[2]?.searchParams.get('to')).toBeNull();
    expect(requests[2]?.searchParams.get('pageToken')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Search by date' }),
    ).toHaveFocus();
  });

  it('reopens an active search with its applied range and keeps date controls outside the status group', async () => {
    window.history.replaceState(
      {},
      '',
      '/accounts/acc_demo/transactions?fromDate=2026-07-20&toDate=2026-07-21',
    );
    const requests: URL[] = [];
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json(listResponse());
      }),
    );
    render(<App />);
    await screen.findByText('Northern Grocer');

    const statusGroup = screen.getByRole('group', {
      name: 'Filter by status',
    });
    expect(
      within(statusGroup).queryByRole('button', { name: /date/i }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Edit date search: Jul 20 – 21',
      }),
    );

    expect(document.querySelector('[data-date="2026-07-20"]')).toHaveAttribute(
      'data-selection-start',
    );
    expect(document.querySelector('[data-date="2026-07-21"]')).toHaveAttribute(
      'data-selection-end',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(requests).toHaveLength(1);
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Edit date search: Jul 20 – 21',
      }),
    );
    await userEvent.click(getDateButton('2026-07-22'));
    expect(screen.getByText('July 22, 2026')).toBeInTheDocument();
    expect(screen.getByText('Select an end date')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    expect(requests).toHaveLength(1);
    await userEvent.click(getDateButton('2026-07-23'));
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(requests).toHaveLength(1);
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Clear date search: Jul 20 – 21',
      }),
    );
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(window.location.search).toBe('');
  });

  it('shows localized query-aware empty states without a create prompt for searches', async () => {
    window.history.replaceState(
      {},
      '',
      '/accounts/acc_demo/transactions?status=posted&fromDate=2026-07-20&toDate=2026-07-21',
    );
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', () =>
        HttpResponse.json(listResponse([])),
      ),
    );
    render(<App />);

    expect(
      await screen.findByText(
        'No posted Transactions were found from Jul 20 – 21',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Create transaction' }),
    ).toHaveLength(1);

    await userEvent.click(screen.getByRole('combobox', { name: 'Language' }));
    await userEvent.click(screen.getByRole('option', { name: 'French' }));

    expect(
      await screen.findByText(
        /Aucune transaction comptabilisée trouvée du 20.+21 juill\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /Modifier la recherche par date : 20.+21 juill\./,
      }),
    ).toBeInTheDocument();
  });

  it('does not insert or count a created Transaction outside the active date query', async () => {
    window.history.replaceState(
      {},
      '',
      '/accounts/acc_demo/transactions?fromDate=2026-07-21&toDate=2026-07-21',
    );
    const outside = transaction('pending');
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', () =>
        HttpResponse.json(listResponse([])),
      ),
      http.post('/api/v1/accounts/acc_demo/transactions', () =>
        HttpResponse.json({ data: outside }, { status: 201 }),
      ),
      http.get('/api/v1/accounts/acc_demo/transactions/txn-001', () =>
        HttpResponse.json({ data: outside }),
      ),
    );
    render(<App />);
    await screen.findByText('No Transactions were found from Jul 21');

    await userEvent.click(
      screen.getByRole('button', { name: 'Create transaction' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Merchant name' }),
      'Outside Merchant',
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Amount (CAD)' }),
      '10.00',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Create purchase' }),
    );
    await screen.findByRole('dialog', { name: 'Transaction details' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Close details' }),
    );

    expect(screen.getByText('0 results')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('switches the complete customer UI to French and persists the preference', async () => {
    window.history.replaceState({}, '', '/accounts/acc_demo/transactions');
    server.use(
      http.get('/api/v1/accounts/acc_demo/transactions', () =>
        HttpResponse.json(listResponse()),
      ),
    );
    render(<App />);
    await screen.findByRole('heading', { name: 'Transaction history' });

    await userEvent.click(screen.getByRole('combobox', { name: 'Language' }));
    await userEvent.click(screen.getByRole('option', { name: 'French' }));

    expect(
      await screen.findByRole('heading', {
        name: 'Historique des transactions',
      }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('fr');
    expect(localStorage.getItem('card-platform-language')).toBe('fr');
    expect(screen.getAllByText('Comptabilisée')).not.toHaveLength(0);
    expect(screen.getByText(/25,99/)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Créer une transaction' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Créer une transaction' }),
    ).toBeInTheDocument();
  });
});
