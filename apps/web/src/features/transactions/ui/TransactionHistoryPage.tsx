import type { TransactionStatus } from '@card-platform/contracts';
import { getLocalTimeZone, parseDate, today } from '@internationalized/date';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import { getDisplayLocale } from '../../../shared/i18n/i18n';
import { useOverlayController } from '../../../shared/overlays/useOverlayController';
import { Button } from '../../../shared/ui/Button';
import { CalendarIcon } from '../../../shared/ui/CalendarIcon';
import {
  EmptyState,
  ErrorState,
  InlineAlert,
  Skeleton,
} from '../../../shared/ui/Feedback';
import { Select } from '../../../shared/ui/Select';
import { StatusBadge } from '../../../shared/ui/StatusBadge';
import { IconButton } from '../../../shared/ui/IconButton';
import type { TransactionHistoryOutletContext } from '../model/history-context';
import {
  ABSOLUTE_MIN_DATE,
  applyDateSearchToParams,
  clearDateSearchFromParams,
  parseAppliedDateRange,
  sameDateRange,
} from '../model/date-range';
import {
  formatAppliedDateRange,
  formatCadAmount,
  formatLocalDateTime,
} from '../model/transaction-formatting';
import { useTransactionHistory } from '../model/useTransactionHistory';
import styles from './TransactionHistoryPage.module.scss';

const statuses: readonly (TransactionStatus | null)[] = [
  null,
  'pending',
  'posted',
  'reversed',
];

const parseStatus = (value: string | null): TransactionStatus | null =>
  value === 'pending' || value === 'posted' || value === 'reversed'
    ? value
    : null;

export const TransactionHistoryPage = () => {
  const restoreDateSearchFocus = useRef(false);
  const { t, i18n } = useTranslation();
  const { accountId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const overlay = useOverlayController();
  const status = parseStatus(searchParams.get('status'));
  const timeZone = getLocalTimeZone();
  const localToday = today(timeZone);
  const searchKey = searchParams.toString();
  const appliedRange = useMemo(
    () => parseAppliedDateRange(new URLSearchParams(searchKey), localToday),
    [localToday, searchKey],
  );
  useEffect(() => {
    if (appliedRange !== null || !restoreDateSearchFocus.current) return;
    restoreDateSearchFocus.current = false;
    document.getElementById('date-search-control')?.focus();
  }, [appliedRange]);
  useEffect(() => {
    const current = new URLSearchParams(searchKey);
    const hasDateParameter = current.has('fromDate') || current.has('toDate');
    if (appliedRange === null && hasDateParameter) {
      setSearchParams(clearDateSearchFromParams(current), { replace: true });
    }
  }, [appliedRange, searchKey, setSearchParams]);
  const activeQuery = useMemo(
    () => ({ status, dateRange: appliedRange, timeZone }),
    [appliedRange, status, timeZone],
  );
  const history = useTransactionHistory(accountId, activeQuery);
  const locale = getDisplayLocale(i18n.resolvedLanguage ?? i18n.language);

  const appliedRangeLabel =
    appliedRange === null
      ? null
      : formatAppliedDateRange(appliedRange, locale, localToday.year);

  const detailPath = (transactionId: string) =>
    `/accounts/${encodeURIComponent(accountId)}/transactions/${encodeURIComponent(transactionId)}${location.search}`;

  const openCreate = () => {
    overlay.openOverlay({
      type: 'create-transaction',
      accountId,
      onCreated: (transaction) => {
        history.prependTransaction(transaction);
        void navigate(detailPath(transaction.id));
      },
    });
  };

  const openDateSearch = () => {
    overlay.openOverlay({
      type: 'transaction-date-search',
      appliedValue:
        appliedRange === null
          ? null
          : {
              start: appliedRange.start.toString(),
              end: appliedRange.end.toString(),
            },
      minDate: ABSOLUTE_MIN_DATE.toString(),
      maxDate: localToday.toString(),
      initialVisibleMonth: (appliedRange?.start ?? localToday).toString(),
      locale,
      onSearch: (range) => {
        const nextRange = {
          start: parseDate(range.start),
          end: parseDate(range.end),
        };
        if (sameDateRange(appliedRange, nextRange)) return;
        setSearchParams(applyDateSearchToParams(searchParams, nextRange));
      },
    });
  };

  const clearDateSearch = () => {
    restoreDateSearchFocus.current = true;
    setSearchParams(clearDateSearchFromParams(searchParams));
  };

  const context: TransactionHistoryOutletContext = {
    updateLoadedTransaction: history.updateLoadedTransaction,
    reconcileStatusTransition: history.reconcileStatusTransition,
  };

  return (
    <>
      <main className={styles.page}>
        <nav
          className={styles.navigation}
          aria-label={t('app.primaryNavigation')}
        >
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              C
            </span>
            {t('app.brand')}
          </div>
          <div className={styles.navigationTools}>
            <Select
              label={t('app.language')}
              value={i18n.resolvedLanguage === 'fr' ? 'fr' : 'en'}
              options={[
                { value: 'en', label: t('app.english') },
                { value: 'fr', label: t('app.french') },
              ]}
              onChange={(language) => void i18n.changeLanguage(language)}
            />
            <span className={styles.accountLabel}>{t('app.demoAccount')}</span>
          </div>
        </nav>

        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>{t('app.account', { accountId })}</p>
            <h1 id="history-heading" tabIndex={-1} className={styles.heading}>
              {t('history.title')}
            </h1>
            <p className={styles.supporting}>{t('history.supporting')}</p>
          </div>
          <Button id="create-transaction-button" onClick={openCreate}>
            {t('create.open')}
          </Button>
        </section>

        <section
          className={styles.surface}
          aria-labelledby="transactions-title"
        >
          <div className={styles.toolbar}>
            <div>
              <h2 id="transactions-title" className="m-0 text-xl font-bold">
                {t('history.transactions')}
              </h2>
              <span className={styles.count}>
                {history.initialLoading
                  ? t('history.loadingTotal')
                  : t('history.resultCount', {
                      count: history.totalCount,
                      formattedCount: new Intl.NumberFormat(locale).format(
                        history.totalCount,
                      ),
                    })}
              </span>
            </div>
            <div
              className={styles.filters}
              role="toolbar"
              aria-label={t('history.filters')}
            >
              <div
                className={styles.statusFilters}
                role="group"
                aria-label={t('history.filterByStatus')}
              >
                {statuses.map((filter) => (
                  <button
                    key={filter ?? 'all'}
                    type="button"
                    className={styles.filter}
                    aria-pressed={status === filter}
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      if (filter === null) next.delete('status');
                      else next.set('status', filter);
                      setSearchParams(next);
                    }}
                  >
                    {filter === null ? t('history.all') : t(`status.${filter}`)}
                  </button>
                ))}
              </div>
              <div className={styles.dateSearchControls}>
                <Button
                  id="date-search-control"
                  tone="ghost"
                  className={styles.dateSearch}
                  onClick={openDateSearch}
                  aria-label={
                    appliedRangeLabel === null
                      ? t('history.searchByDate')
                      : t('history.editDateSearch', {
                          range: appliedRangeLabel,
                        })
                  }
                >
                  <CalendarIcon />
                  {appliedRangeLabel ?? t('history.searchByDate')}
                </Button>
                {appliedRangeLabel === null ? null : (
                  <IconButton
                    className={styles.clearDateSearch}
                    label={t('history.clearDateSearch', {
                      range: appliedRangeLabel,
                    })}
                    onClick={clearDateSearch}
                  />
                )}
              </div>
            </div>
          </div>

          {history.initialLoading ? (
            <div className="grid gap-4 p-5" aria-label={t('history.loading')}>
              <Skeleton height="4.5rem" />
              <Skeleton height="4.5rem" />
              <Skeleton height="4.5rem" />
            </div>
          ) : history.initialError ? (
            <ErrorState
              message={t(history.initialError)}
              onRetry={history.retry}
            />
          ) : history.items.length === 0 ? (
            <EmptyState
              title={t('history.emptyTitle')}
              message={
                appliedRangeLabel !== null && status !== null
                  ? t('history.emptyStatusDate', {
                      status: t(`status.${status}`).toLocaleLowerCase(locale),
                      range: appliedRangeLabel,
                    })
                  : appliedRangeLabel !== null
                    ? t('history.emptyDate', { range: appliedRangeLabel })
                    : status !== null
                      ? t('history.emptyStatus', {
                          status: t(`status.${status}`).toLocaleLowerCase(
                            locale,
                          ),
                        })
                      : t('history.emptyAll')
              }
              {...(status === null && appliedRange === null
                ? {
                    action: (
                      <Button tone="secondary" onClick={openCreate}>
                        {t('create.open')}
                      </Button>
                    ),
                  }
                : {})}
            />
          ) : (
            <ul className={styles.list} aria-label={t('history.listLabel')}>
              {history.items.map((transaction) => (
                <li className={styles.row} key={transaction.id}>
                  <div className={styles.identity}>
                    <p className={styles.merchant}>
                      {transaction.merchantName}
                    </p>
                    <p className={styles.date}>
                      {formatLocalDateTime(transaction.transactionDate, locale)}
                    </p>
                  </div>
                  <span className={styles.amount}>
                    {formatCadAmount(transaction.amount.minorUnits, locale)}
                  </span>
                  <div className={styles.status}>
                    <StatusBadge status={transaction.status} />
                  </div>
                  <Button
                    className={styles.action}
                    tone="ghost"
                    id={`transaction-trigger-${encodeURIComponent(transaction.id)}`}
                    onClick={() =>
                      void navigate(detailPath(transaction.id), {
                        state: {
                          focusTargetId: `transaction-trigger-${encodeURIComponent(transaction.id)}`,
                        },
                      })
                    }
                    aria-label={t('history.viewDetails', {
                      merchant: transaction.merchantName,
                    })}
                  >
                    {t('history.details')}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {!history.initialLoading &&
          !history.initialError &&
          history.hasMore ? (
            <div className={styles.footer}>
              {history.loadMoreError ? (
                <InlineAlert tone="error">
                  {t(history.loadMoreError)}
                </InlineAlert>
              ) : null}
              <Button
                tone="secondary"
                loading={history.loadingMore}
                onClick={() => void history.loadMore()}
              >
                {history.loadMoreError
                  ? t('history.retryLoadMore')
                  : t('history.loadMore')}
              </Button>
            </div>
          ) : null}
        </section>
      </main>
      <Outlet context={context} />
    </>
  );
};
