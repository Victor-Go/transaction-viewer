import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ApiError,
  isUncertainWriteError,
} from '../../../shared/api/api-client';
import { ConfirmDialog } from '../../../shared/overlays/ConfirmDialog';
import type {
  ConfirmTransactionReversalOverlayRequest,
  OverlayLayer,
} from '../../../shared/overlays/overlay-types';
import { getTransaction, reverseTransaction } from '../api/transactions-api';
import {
  beginIdempotentAttempt,
  completeIdempotentAttempt,
  createIdempotentAttempt,
} from '../model/idempotency-attempt';
import { formatCadAmount } from '../model/transaction-formatting';
import { getDisplayLocale } from '../../../shared/i18n/i18n';
import styles from './TransactionDetailRouteOverlay.module.scss';

export const ReversalConfirmDialog = ({
  request,
  layer,
  open = true,
  onClose,
  onExited,
}: {
  readonly request: ConfirmTransactionReversalOverlayRequest;
  readonly layer: OverlayLayer;
  readonly open?: boolean;
  readonly onClose: () => void;
  readonly onExited?: () => void;
}) => {
  const { t, i18n } = useTranslation();
  const attempt = useRef(createIdempotentAttempt());
  const activeController = useRef<AbortController | null>(null);
  const [conflict, setConflict] = useState(false);
  const locale = getDisplayLocale(i18n.resolvedLanguage ?? i18n.language);

  useEffect(
    () => () => {
      activeController.current?.abort();
    },
    [],
  );

  const refresh = async () => {
    const response = await getTransaction(
      request.accountId,
      request.transaction.id,
      activeController.current?.signal,
    );
    request.onResolved(response.data);
    return response.data;
  };

  const confirm = async () => {
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    const intent = `${request.accountId}|${request.transaction.id}|reversal`;
    attempt.current = beginIdempotentAttempt(attempt.current, intent, () =>
      crypto.randomUUID(),
    );
    const key = attempt.current.key;
    if (key === null) return;

    try {
      const response = await reverseTransaction(
        request.accountId,
        request.transaction.id,
        key,
        controller.signal,
      );
      attempt.current = completeIdempotentAttempt(attempt.current, 'success');
      request.onResolved(response.data);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        if (
          error.code === 'TRANSACTION_NOT_POSTED' ||
          error.code === 'TRANSACTION_ALREADY_REVERSED'
        ) {
          attempt.current = completeIdempotentAttempt(
            attempt.current,
            'rejected',
          );
          await refresh();
          onClose();
          return;
        }
        if (error.code === 'REVERSAL_WINDOW_EXPIRED') {
          attempt.current = completeIdempotentAttempt(
            attempt.current,
            'rejected',
          );
          request.onResolved({ ...request.transaction, canReverse: false });
          onClose();
          return;
        }
        if (error.code === 'TRANSACTION_NOT_FOUND') {
          attempt.current = completeIdempotentAttempt(
            attempt.current,
            'rejected',
          );
          request.onNotFound();
          onClose();
          return;
        }
        if (error.code === 'IDEMPOTENCY_CONFLICT') {
          attempt.current = completeIdempotentAttempt(
            attempt.current,
            'rejected',
          );
          setConflict(true);
          throw new Error(t('reverse.conflict'));
        }
      }

      attempt.current = completeIdempotentAttempt(
        attempt.current,
        isUncertainWriteError(error) ? 'uncertain' : 'rejected',
      );
      throw new Error(t('reverse.uncertain'));
    } finally {
      if (activeController.current === controller) {
        activeController.current = null;
      }
    }
  };

  return (
    <ConfirmDialog
      title={t('reverse.title')}
      description={t('reverse.description')}
      confirmLabel={t('reverse.submit')}
      confirmTone="danger"
      layer={layer}
      open={open}
      onCancel={onClose}
      {...(onExited === undefined ? {} : { onExited })}
      onConfirm={confirm}
      confirmDisabled={conflict}
    >
      <div className={styles.confirmSummary}>
        <strong>{request.transaction.merchantName}</strong>
        <strong>
          {formatCadAmount(request.transaction.amount.minorUnits, locale)}
        </strong>
      </div>
    </ConfirmDialog>
  );
};
