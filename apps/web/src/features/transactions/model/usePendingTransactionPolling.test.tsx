import type { TransactionDto } from '@card-platform/contracts';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTransaction } from '../api/transactions-api';
import { usePendingTransactionPolling } from './usePendingTransactionPolling';

vi.mock('../api/transactions-api', () => ({
  getTransaction: vi.fn(),
}));

const pending: TransactionDto = {
  id: 'txn-001',
  accountId: 'acc_demo',
  merchantName: 'Northern Grocer',
  amount: { minorUnits: 2599, currency: 'CAD' },
  status: 'pending',
  transactionDate: '2026-07-20T18:30:00.000Z',
  createdAt: '2026-07-20T18:30:00.000Z',
  updatedAt: '2026-07-20T18:30:00.000Z',
  reversedAt: null,
  canReverse: false,
  reverseExpiresAt: '2026-08-20T18:30:00.000Z',
};

const posted: TransactionDto = {
  ...pending,
  status: 'posted',
  reversedAt: null,
  canReverse: true,
};

describe('usePendingTransactionPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getTransaction).mockReset();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  afterEach(() => vi.useRealTimers());

  it('stops scheduling after a terminal status', async () => {
    vi.mocked(getTransaction).mockResolvedValue({ data: posted });
    const onUpdate = vi.fn();
    renderHook(() =>
      usePendingTransactionPolling({
        transaction: pending,
        onUpdate,
        onPollingError: vi.fn(),
      }),
    );

    await act(() => vi.advanceTimersByTimeAsync(2000));
    await act(() => vi.advanceTimersByTimeAsync(10_000));

    expect(onUpdate).toHaveBeenCalledWith(posted);
    expect(getTransaction).toHaveBeenCalledOnce();
  });

  it('never overlaps requests and schedules recursively after completion', async () => {
    let resolveRequest: ((value: { data: TransactionDto }) => void) | undefined;
    vi.mocked(getTransaction).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    renderHook(() =>
      usePendingTransactionPolling({
        transaction: pending,
        onUpdate: vi.fn(),
        onPollingError: vi.fn(),
      }),
    );

    await act(() => vi.advanceTimersByTimeAsync(12_000));
    expect(getTransaction).toHaveBeenCalledOnce();

    await act(async () => resolveRequest?.({ data: pending }));
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(getTransaction).toHaveBeenCalledTimes(2);
  });

  it('pauses while hidden, resumes when visible, and aborts on unmount', async () => {
    let visibility = 'hidden';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
    let signal: AbortSignal | undefined;
    vi.mocked(getTransaction).mockImplementation(
      (_accountId, _transactionId, requestSignal) => {
        signal = requestSignal;
        return new Promise(() => undefined);
      },
    );
    const { unmount } = renderHook(() =>
      usePendingTransactionPolling({
        transaction: pending,
        onUpdate: vi.fn(),
        onPollingError: vi.fn(),
      }),
    );

    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(getTransaction).not.toHaveBeenCalled();

    visibility = 'visible';
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(getTransaction).toHaveBeenCalledOnce();

    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
