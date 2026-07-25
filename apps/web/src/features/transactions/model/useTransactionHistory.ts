import type { TransactionDto } from '@card-platform/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { listTransactions } from '../api/transactions-api';
import {
  RequestAbortedError,
  ResponseContractError,
} from '../../../shared/api/api-client';
import {
  appendTransactionPage,
  prependCreatedTransaction,
  reconcileStatusTransition,
  updateLoadedTransaction,
  type TransactionListQuery,
} from './transaction-list-state';
import { toUtcDateRange } from './date-range';

const PAGE_SIZE = 20;

interface HistoryState {
  readonly items: readonly TransactionDto[];
  readonly totalCount: number;
  readonly hasMore: boolean;
  readonly nextPageToken: string | null;
  readonly initialLoading: boolean;
  readonly initialError: string | null;
  readonly loadingMore: boolean;
  readonly loadMoreError: string | null;
}

const initialState: HistoryState = {
  items: [],
  totalCount: 0,
  hasMore: false,
  nextPageToken: null,
  initialLoading: true,
  initialError: null,
  loadingMore: false,
  loadMoreError: null,
};

const readErrorMessage = (error: unknown): string =>
  error instanceof ResponseContractError
    ? 'history.loadContractError'
    : 'history.loadError';

export const useTransactionHistory = (
  accountId: string,
  query: TransactionListQuery,
) => {
  const [state, setState] = useState<HistoryState>(initialState);
  const [reload, setReload] = useState(0);
  const requestVersion = useRef(0);
  const loadMoreController = useRef<AbortController | null>(null);
  const status = query.status;
  const backendRange =
    query.dateRange === null
      ? null
      : toUtcDateRange(query.dateRange, query.timeZone);
  const rangeFrom = backendRange?.from;
  const rangeTo = backendRange?.to;

  useEffect(() => {
    const version = ++requestVersion.current;
    const controller = new AbortController();
    loadMoreController.current?.abort();
    loadMoreController.current = null;
    setState(initialState);

    void listTransactions(accountId, {
      pageSize: PAGE_SIZE,
      ...(status === null ? {} : { status }),
      ...(rangeFrom === undefined || rangeTo === undefined
        ? {}
        : { from: rangeFrom, to: rangeTo }),
      signal: controller.signal,
    })
      .then((response) => {
        if (requestVersion.current !== version) return;
        setState({
          items: response.data,
          totalCount: response.meta.totalCount,
          hasMore: response.meta.hasMore,
          nextPageToken: response.meta.nextPageToken,
          initialLoading: false,
          initialError: null,
          loadingMore: false,
          loadMoreError: null,
        });
      })
      .catch((error: unknown) => {
        if (
          error instanceof RequestAbortedError ||
          requestVersion.current !== version
        ) {
          return;
        }
        setState({
          ...initialState,
          initialLoading: false,
          initialError: readErrorMessage(error),
        });
      });

    return () => {
      controller.abort();
      loadMoreController.current?.abort();
    };
  }, [accountId, rangeFrom, rangeTo, reload, status]);

  const retry = useCallback(() => setReload((value) => value + 1), []);

  const loadMore = useCallback(async () => {
    if (state.loadingMore || !state.hasMore || state.nextPageToken === null) {
      return;
    }
    const version = requestVersion.current;
    const controller = new AbortController();
    loadMoreController.current?.abort();
    loadMoreController.current = controller;
    setState((current) => ({
      ...current,
      loadingMore: true,
      loadMoreError: null,
    }));
    try {
      const response = await listTransactions(accountId, {
        pageSize: PAGE_SIZE,
        ...(status === null ? {} : { status }),
        ...(rangeFrom === undefined || rangeTo === undefined
          ? {}
          : { from: rangeFrom, to: rangeTo }),
        pageToken: state.nextPageToken,
        signal: controller.signal,
      });
      if (requestVersion.current !== version) return;
      setState((current) => ({
        ...current,
        items: appendTransactionPage(current.items, response.data),
        totalCount: response.meta.totalCount,
        hasMore: response.meta.hasMore,
        nextPageToken: response.meta.nextPageToken,
        loadingMore: false,
        loadMoreError: null,
      }));
    } catch (error) {
      if (
        error instanceof RequestAbortedError ||
        requestVersion.current !== version
      ) {
        return;
      }
      setState((current) => ({
        ...current,
        loadingMore: false,
        loadMoreError: readErrorMessage(error),
      }));
    } finally {
      if (loadMoreController.current === controller) {
        loadMoreController.current = null;
      }
    }
  }, [
    accountId,
    state.hasMore,
    state.loadingMore,
    state.nextPageToken,
    status,
    rangeFrom,
    rangeTo,
  ]);

  const updateLoaded = useCallback((transaction: TransactionDto) => {
    setState((current) => ({
      ...current,
      ...updateLoadedTransaction(current, transaction),
    }));
  }, []);

  const prependTransaction = useCallback(
    (transaction: TransactionDto) => {
      setState((current) => ({
        ...current,
        ...prependCreatedTransaction(current, transaction, query),
      }));
    },
    [query],
  );

  const reconcileTransition = useCallback(
    (previous: TransactionDto, next: TransactionDto) => {
      setState((current) => ({
        ...current,
        ...reconcileStatusTransition(current, previous, next, query),
      }));
    },
    [query],
  );

  return {
    ...state,
    retry,
    loadMore,
    updateLoadedTransaction: updateLoaded,
    reconcileStatusTransition: reconcileTransition,
    prependTransaction,
  };
};
