import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, type ButtonTone } from '../ui/Button';
import { InlineAlert } from '../ui/Feedback';
import { IconButton } from '../ui/IconButton';
import type { OverlayLayer } from './overlay-types';
import { ResponsiveOverlay } from './ResponsiveOverlay';
import styles from './ResponsiveOverlay.module.scss';

interface ConfirmDialogProps {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly confirmTone?: Extract<ButtonTone, 'primary' | 'danger'>;
  readonly layer: OverlayLayer;
  readonly open?: boolean;
  readonly onCancel: () => void;
  readonly onExited?: () => void;
  readonly onConfirm: () => Promise<void>;
  readonly confirmDisabled?: boolean;
  readonly children?: ReactNode;
}

export const ConfirmDialog = ({
  title,
  description,
  confirmLabel,
  confirmTone = 'primary',
  layer,
  open = true,
  onCancel,
  onExited,
  onConfirm,
  confirmDisabled = false,
  children,
}: ConfirmDialogProps) => {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = async () => {
    if (submitting || confirmDisabled) return;
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t('reverse.genericError'),
      );
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveOverlay
      kind="alertdialog"
      open={open}
      layer={layer}
      dismissible={!submitting}
      labelledBy={titleId}
      describedBy={descriptionId}
      onClose={onCancel}
      {...(onExited === undefined ? {} : { onExited })}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        cancelRef.current?.focus();
      }}
    >
      <IconButton
        className={styles.closeButton}
        label={t('reverse.close')}
        onClick={onCancel}
        disabled={submitting}
      />
      <header className={styles.header}>
        <AlertDialogPrimitive.Title className={styles.title} id={titleId}>
          {title}
        </AlertDialogPrimitive.Title>
        <AlertDialogPrimitive.Description
          className={styles.description}
          id={descriptionId}
        >
          {description}
        </AlertDialogPrimitive.Description>
      </header>
      <div className={styles.body}>
        {children}
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      </div>
      <footer className={styles.actions}>
        <AlertDialogPrimitive.Cancel asChild>
          <Button ref={cancelRef} tone="secondary" disabled={submitting}>
            {t('reverse.cancel')}
          </Button>
        </AlertDialogPrimitive.Cancel>
        <Button
          tone={confirmTone}
          onClick={() => void confirm()}
          disabled={confirmDisabled}
          loading={submitting}
        >
          {submitting ? t('reverse.submitting') : confirmLabel}
        </Button>
      </footer>
    </ResponsiveOverlay>
  );
};
