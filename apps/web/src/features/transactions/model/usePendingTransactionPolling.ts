import type { TransactionDto } from '@card-platform/contracts';
import { useEffect } from 'react';

import { getTransaction } from '../api/transactions-api';
import { RequestAbortedError } from '../../../shared/api/api-client';

const POLL_DELAY_MS = 2000;

export const usePendingTransactionPolling = ({
  transaction,
  onUpdate,
  onPollingError,
}: {
  readonly transaction: TransactionDto | null;
  readonly onUpdate: (transaction: TransactionDto) => void;
  readonly onPollingError: (message: string | null) => void;
}) => {
  const accountId = transaction?.accountId;
  const transactionId = transaction?.id;
  const status = transaction?.status;

  useEffect(() => {
    if (
      status !== 'pending' ||
      accountId === undefined ||
      transactionId === undefined
    ) {
      return undefined;
    }

    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let activeController: AbortController | undefined;

    const schedule = () => {
      if (stopped || document.visibilityState === 'hidden') return;
      timer = setTimeout(() => void poll(), POLL_DELAY_MS);
    };

    const poll = async () => {
      if (stopped || running || document.visibilityState === 'hidden') return;
      running = true;
      activeController = new AbortController();
      try {
        const response = await getTransaction(
          accountId,
          transactionId,
          activeController.signal,
        );
        if (stopped) return;
        onPollingError(null);
        onUpdate(response.data);
        if (response.data.status === 'pending') schedule();
      } catch (error) {
        if (stopped || error instanceof RequestAbortedError) return;
        onPollingError('detail.pollingError');
        schedule();
      } finally {
        running = false;
        activeController = undefined;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (timer !== undefined) clearTimeout(timer);
        activeController?.abort();
        return;
      }
      void poll();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    schedule();

    return () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      activeController?.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [accountId, onPollingError, onUpdate, status, transactionId]);
};
