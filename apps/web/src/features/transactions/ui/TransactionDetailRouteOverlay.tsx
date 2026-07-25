import type { TransactionDto } from '@card-platform/contracts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom';

import {
  ApiError,
  ResponseContractError,
} from '../../../shared/api/api-client';
import { Dialog } from '../../../shared/overlays/Dialog';
import {
  useOverlayController,
  useOverlayLayer,
} from '../../../shared/overlays/useOverlayController';
import { Button } from '../../../shared/ui/Button';
import { ErrorState, InlineAlert, Skeleton } from '../../../shared/ui/Feedback';
import { StatusBadge } from '../../../shared/ui/StatusBadge';
import { getTransaction } from '../api/transactions-api';
import type { TransactionHistoryOutletContext } from '../model/history-context';
import { getReversalEligibility } from '../model/reversal-eligibility';
import {
  formatCadAmount,
  formatLocalDateTime,
} from '../model/transaction-formatting';
import { usePendingTransactionPolling } from '../model/usePendingTransactionPolling';
import styles from './TransactionDetailRouteOverlay.module.scss';
import { getDisplayLocale } from '../../../shared/i18n/i18n';

type DetailState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'success'; readonly transaction: TransactionDto }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'contract-error' }
  | { readonly kind: 'error' };

export const TransactionDetailRouteOverlay = () => {
  const { t, i18n } = useTranslation();
  const { accountId = '', transactionId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const history = useOutletContext<TransactionHistoryOutletContext>();
  const overlay = useOverlayController();
  const controlledId = `transaction-detail:${accountId}:${transactionId}`;
  const layer = useOverlayLayer(controlledId, true);
  const [state, setState] = useState<DetailState>({ kind: 'loading' });
  const [loadVersion, setLoadVersion] = useState(0);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [dialogOpen, setDialogOpen] = useState(true);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const locale = getDisplayLocale(i18n.resolvedLanguage ?? i18n.language);

  const closePath = `/accounts/${encodeURIComponent(accountId)}/transactions${location.search}`;
  const focusTargetId =
    typeof location.state === 'object' &&
    location.state !== null &&
    'focusTargetId' in location.state &&
    typeof location.state.focusTargetId === 'string'
      ? location.state.focusTargetId
      : null;
  const close = useCallback(() => {
    setDialogOpen(false);
  }, []);
  const finishClose = useCallback(() => {
    void navigate(closePath);
  }, [closePath, navigate]);

  useEffect(
    () => () => {
      requestAnimationFrame(() => {
        const requested =
          focusTargetId === null
            ? null
            : document.getElementById(focusTargetId);
        const fallback =
          document.getElementById('history-heading') ??
          document.getElementById('create-transaction-button');
        (requested ?? fallback)?.focus();
      });
    },
    [focusTargetId],
  );

  const transactionRef = useRef<TransactionDto | null>(null);
  const updateLoadedTransaction = history.updateLoadedTransaction;
  const reconcileStatusTransition = history.reconcileStatusTransition;
  const acceptTransaction = useCallback(
    (transaction: TransactionDto) => {
      const previous = transactionRef.current;
      if (previous === null || previous.id !== transaction.id) {
        updateLoadedTransaction(transaction);
      } else if (previous.status !== transaction.status) {
        reconcileStatusTransition(previous, transaction);
      } else {
        updateLoadedTransaction(transaction);
      }
      transactionRef.current = transaction;
      setState({ kind: 'success', transaction });
    },
    [reconcileStatusTransition, updateLoadedTransaction],
  );

  useEffect(() => {
    const controller = new AbortController();
    void getTransaction(accountId, transactionId, controller.signal)
      .then((response) => acceptTransaction(response.data))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (
          error instanceof ApiError &&
          error.code === 'TRANSACTION_NOT_FOUND'
        ) {
          setState({ kind: 'not-found' });
        } else if (error instanceof ResponseContractError) {
          setState({ kind: 'contract-error' });
        } else {
          setState({ kind: 'error' });
        }
      });
    return () => controller.abort();
  }, [acceptTransaction, accountId, loadVersion, transactionId]);

  const transaction = state.kind === 'success' ? state.transaction : null;
  usePendingTransactionPolling({
    transaction,
    onUpdate: acceptTransaction,
    onPollingError: setPollingError,
  });

  useEffect(() => {
    if (transaction?.status !== 'posted' || !transaction.canReverse) {
      return undefined;
    }
    const deadline = Date.parse(transaction.reverseExpiresAt);
    if (!Number.isFinite(deadline)) return undefined;
    const interval = setInterval(() => {
      const current = new Date();
      setNow(current);
      if (current.getTime() > deadline) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [
    transaction?.canReverse,
    transaction?.reverseExpiresAt,
    transaction?.status,
  ]);

  const eligibility = useMemo(
    () =>
      transaction
        ? getReversalEligibility(
            transaction.canReverse,
            transaction.reverseExpiresAt,
            now,
          )
        : null,
    [now, transaction],
  );

  const openReversal = () => {
    if (!transaction || !eligibility?.eligible) return;
    overlay.openOverlay(
      {
        type: 'confirm-transaction-reversal',
        accountId,
        transaction,
        onResolved: (resolved) => {
          acceptTransaction(resolved);
          if (resolved.status === 'reversed') {
            requestAnimationFrame(() => titleRef.current?.focus());
          }
        },
        onNotFound: () => setState({ kind: 'not-found' }),
      },
      { ownerId: controlledId },
    );
  };

  let content;
  if (state.kind === 'loading') {
    content = (
      <div className="grid gap-4" aria-label={t('detail.loading')}>
        <Skeleton height="5rem" />
        <Skeleton height="10rem" />
      </div>
    );
  } else if (state.kind === 'not-found') {
    content = <InlineAlert tone="warning">{t('detail.notFound')}</InlineAlert>;
  } else if (state.kind === 'contract-error') {
    content = (
      <ErrorState
        message={t('detail.contractError')}
        onRetry={() => {
          setState({ kind: 'loading' });
          setLoadVersion((value) => value + 1);
        }}
      />
    );
  } else if (state.kind === 'error') {
    content = (
      <ErrorState
        message={t('detail.loadError')}
        onRetry={() => {
          setState({ kind: 'loading' });
          setLoadVersion((value) => value + 1);
        }}
      />
    );
  } else {
    const detail = state.transaction;
    content = (
      <>
        <section className={styles.summary}>
          <p className={styles.merchant}>{detail.merchantName}</p>
          <p className={styles.amount}>
            {formatCadAmount(detail.amount.minorUnits, locale)}
          </p>
          <StatusBadge status={detail.status} />
        </section>

        {detail.status === 'pending' ? (
          <InlineAlert tone="information">{t('detail.pending')}</InlineAlert>
        ) : null}
        {pollingError ? (
          <InlineAlert tone="warning">{t(pollingError)}</InlineAlert>
        ) : null}

        <dl className={styles.metadata}>
          <div className={styles.datum}>
            <dt>{t('detail.transactionDate')}</dt>
            <dd>{formatLocalDateTime(detail.transactionDate, locale)}</dd>
          </div>
          <div className={styles.datum}>
            <dt>{t('detail.created')}</dt>
            <dd>{formatLocalDateTime(detail.createdAt, locale)}</dd>
          </div>
          <div className={styles.datum}>
            <dt>{t('detail.updated')}</dt>
            <dd>{formatLocalDateTime(detail.updatedAt, locale)}</dd>
          </div>
          {detail.reversedAt ? (
            <div className={styles.datum}>
              <dt>{t('detail.reversed')}</dt>
              <dd>{formatLocalDateTime(detail.reversedAt, locale)}</dd>
            </div>
          ) : null}
        </dl>

        <section
          className={styles.eligibility}
          aria-label={t('detail.eligibility')}
        >
          {detail.status === 'pending' ? (
            <p>{t('detail.pendingNotReversible')}</p>
          ) : detail.status === 'reversed' ? (
            <p>{t('detail.alreadyReversed')}</p>
          ) : eligibility?.reason === 'invalid-deadline' ? (
            <InlineAlert tone="error">
              {t('detail.invalidDeadline')}
            </InlineAlert>
          ) : (
            <>
              <p>
                {t('detail.deadline', {
                  date: formatLocalDateTime(detail.reverseExpiresAt, locale),
                })}
              </p>
              {!eligibility?.eligible ? (
                <InlineAlert tone="warning">{t('detail.expired')}</InlineAlert>
              ) : null}
            </>
          )}
        </section>
      </>
    );
  }

  return (
    <Dialog
      title={t('detail.title')}
      titleRef={titleRef}
      open={dialogOpen}
      closeLabel={t('detail.closeLabel')}
      layer={layer}
      onClose={close}
      onExited={finishClose}
      actions={
        <>
          <Button tone="secondary" onClick={close}>
            {t('detail.close')}
          </Button>
          {transaction?.status === 'posted' ? (
            <Button
              tone="danger"
              onClick={openReversal}
              disabled={!eligibility?.eligible}
            >
              {t('detail.reverse')}
            </Button>
          ) : null}
        </>
      }
    >
      {content}
    </Dialog>
  );
};
