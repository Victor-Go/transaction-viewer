import type {
  TransactionDto,
  TransactionStatus,
} from '@card-platform/contracts';

import type { CalendarDateRange } from '../../../shared/date/calendar-date-range';
import { toUtcDateRange } from './date-range';

export interface TransactionListState {
  readonly items: readonly TransactionDto[];
  readonly totalCount: number;
}

export interface TransactionListQuery {
  readonly status: TransactionStatus | null;
  readonly dateRange: CalendarDateRange | null;
  readonly timeZone: string;
}

const compareTransactions = (
  left: TransactionDto,
  right: TransactionDto,
): number => {
  const byDate =
    Date.parse(right.transactionDate) - Date.parse(left.transactionDate);
  return byDate === 0 ? right.id.localeCompare(left.id) : byDate;
};

export const appendTransactionPage = (
  current: readonly TransactionDto[],
  page: readonly TransactionDto[],
): TransactionDto[] => {
  const seen = new Set(current.map(({ id }) => id));
  return [
    ...current,
    ...page.filter(({ id }) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }),
  ];
};

export const matchesActiveQuery = (
  transaction: TransactionDto,
  query: TransactionListQuery,
): boolean => {
  if (query.status !== null && transaction.status !== query.status) {
    return false;
  }
  if (query.dateRange === null) return true;
  const transactionInstant = Date.parse(transaction.transactionDate);
  if (Number.isNaN(transactionInstant)) return false;
  const { from, to } = toUtcDateRange(query.dateRange, query.timeZone);
  return (
    transactionInstant >= Date.parse(from) &&
    transactionInstant < Date.parse(to)
  );
};

export const updateLoadedTransaction = (
  state: TransactionListState,
  transaction: TransactionDto,
): TransactionListState => {
  const existingIndex = state.items.findIndex(
    ({ id }) => id === transaction.id,
  );
  if (existingIndex === -1) return state;
  return {
    items: state.items.map((item) =>
      item.id === transaction.id ? transaction : item,
    ),
    totalCount: state.totalCount,
  };
};

export const prependCreatedTransaction = (
  state: TransactionListState,
  transaction: TransactionDto,
  query: TransactionListQuery,
): TransactionListState => {
  if (!matchesActiveQuery(transaction, query)) return state;
  const existing = state.items.some(({ id }) => id === transaction.id);
  if (existing) return updateLoadedTransaction(state, transaction);
  return {
    items: [...state.items, transaction].sort(compareTransactions),
    totalCount: state.totalCount + 1,
  };
};

export const reconcileStatusTransition = (
  state: TransactionListState,
  previous: TransactionDto,
  next: TransactionDto,
  query: TransactionListQuery,
): TransactionListState => {
  const belonged = matchesActiveQuery(previous, query);
  const belongs = matchesActiveQuery(next, query);
  const isLoaded = state.items.some(({ id }) => id === next.id);

  if (belonged && !belongs) {
    return {
      items: state.items.filter(({ id }) => id !== next.id),
      totalCount: Math.max(0, state.totalCount - 1),
    };
  }
  if (!belonged && belongs) {
    return isLoaded
      ? updateLoadedTransaction(state, next)
      : {
          items: [...state.items, next].sort(compareTransactions),
          totalCount: state.totalCount + 1,
        };
  }
  return belongs ? updateLoadedTransaction(state, next) : state;
};
