import { createTransactionRequestSchema } from '@card-platform/contracts';
import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ApiError,
  isUncertainWriteError,
} from '../../../shared/api/api-client';
import { Dialog } from '../../../shared/overlays/Dialog';
import type {
  CreateTransactionOverlayRequest,
  OverlayLayer,
} from '../../../shared/overlays/overlay-types';
import { Button } from '../../../shared/ui/Button';
import { InlineAlert } from '../../../shared/ui/Feedback';
import {
  CurrencyInput,
  FormField,
  TextInput,
} from '../../../shared/ui/FormControls';
import { createTransaction } from '../api/transactions-api';
import {
  beginIdempotentAttempt,
  completeIdempotentAttempt,
  createIdempotentAttempt,
} from '../model/idempotency-attempt';
import { parseCadAmountInput } from '../model/transaction-formatting';
import styles from './CreateTransactionDialog.module.scss';

interface FieldErrors {
  readonly merchant?: string;
  readonly amount?: string;
}

export const CreateTransactionDialog = ({
  request,
  layer,
  open = true,
  onClose,
  onExited,
}: {
  readonly request: CreateTransactionOverlayRequest;
  readonly layer: OverlayLayer;
  readonly open?: boolean;
  readonly onClose: () => void;
  readonly onExited?: () => void;
}) => {
  const { t } = useTranslation();
  const [merchantName, setMerchantName] = useState('');
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const attempt = useRef(createIdempotentAttempt());
  const merchantRef = useRef<HTMLInputElement>(null);

  const createErrorMessage = (error: unknown): string => {
    if (error instanceof ApiError) {
      if (error.code === 'IDEMPOTENCY_CONFLICT') return t('create.conflict');
      if (error.code === 'INVALID_REQUEST') return t('create.rejected');
      if (error.status >= 500) return t('create.uncertain');
    }
    return isUncertainWriteError(error)
      ? t('create.uncertain')
      : t('create.uncertainNetwork');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const amountResult = parseCadAmountInput(amount);
    const trimmedMerchantName = merchantName.trim();
    const nextErrors: FieldErrors = {
      ...(trimmedMerchantName.length === 0
        ? { merchant: t('create.merchantRequired') }
        : {}),
      ...(!amountResult.success ? { amount: t('create.amountInvalid') } : {}),
    };
    if (Object.keys(nextErrors).length > 0 || !amountResult.success) {
      setErrors(nextErrors);
      return;
    }

    const parsed = createTransactionRequestSchema.safeParse({
      merchantName: trimmedMerchantName,
      amount: { minorUnits: amountResult.minorUnits, currency: 'CAD' },
    });
    if (!parsed.success) {
      setErrors({
        merchant: t('create.merchantLength'),
      });
      return;
    }

    const intent = JSON.stringify(parsed.data);
    attempt.current = beginIdempotentAttempt(attempt.current, intent, () =>
      crypto.randomUUID(),
    );
    const key = attempt.current.key;
    if (key === null) return;

    setErrors({});
    setRequestError(null);
    setSubmitting(true);
    try {
      const response = await createTransaction(
        request.accountId,
        parsed.data,
        key,
      );
      attempt.current = completeIdempotentAttempt(attempt.current, 'success');
      onClose();
      request.onCreated(response.data);
    } catch (error) {
      attempt.current = completeIdempotentAttempt(
        attempt.current,
        isUncertainWriteError(error) ? 'uncertain' : 'rejected',
      );
      setRequestError(createErrorMessage(error));
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      title={t('create.title')}
      open={open}
      description={t('create.description')}
      closeLabel={t('create.close')}
      layer={layer}
      dismissible={!submitting}
      onClose={onClose}
      {...(onExited === undefined ? {} : { onExited })}
      initialFocusRef={merchantRef}
      actions={
        <>
          <Button tone="secondary" onClick={onClose} disabled={submitting}>
            {t('create.cancel')}
          </Button>
          <Button
            type="submit"
            form="create-transaction-form"
            loading={submitting}
          >
            {t('create.submit')}
          </Button>
        </>
      }
    >
      <form
        id="create-transaction-form"
        className={styles.form}
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        {requestError ? (
          <InlineAlert tone="error">{requestError}</InlineAlert>
        ) : null}
        <FormField
          id="merchant-name"
          label={t('create.merchant')}
          error={errors.merchant}
        >
          <TextInput
            ref={merchantRef}
            id="merchant-name"
            value={merchantName}
            maxLength={120}
            autoComplete="organization"
            error={errors.merchant}
            onChange={(event) => setMerchantName(event.target.value)}
          />
        </FormField>
        <FormField
          id="transaction-amount"
          label={t('create.amount')}
          hint={t('create.amountHint')}
          error={errors.amount}
        >
          <CurrencyInput
            id="transaction-amount"
            value={amount}
            placeholder={t('create.amountPlaceholder')}
            error={errors.amount}
            hint={t('create.amountHint')}
            onChange={(event) => setAmount(event.target.value)}
          />
        </FormField>
        <span className={styles.amountNote}>{t('create.pendingNote')}</span>
      </form>
    </Dialog>
  );
};
