import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from './Button';
import styles from './Feedback.module.scss';

type AlertTone = 'information' | 'error' | 'warning' | 'success';

export const InlineAlert = ({
  tone,
  children,
}: {
  readonly tone: AlertTone;
  readonly children: ReactNode;
}) => (
  <div
    className={clsx(styles.alert, styles[tone])}
    role={tone === 'error' ? 'alert' : 'status'}
  >
    {children}
  </div>
);

export const Skeleton = ({ height = '1rem' }: { readonly height?: string }) => (
  <div
    className={styles.skeleton}
    style={{ height }}
    aria-hidden="true"
    data-testid="skeleton"
  />
);

export const Spinner = ({ label }: { readonly label: string }) => (
  <span role="status" aria-label={label}>
    <span className={styles.spinner} aria-hidden="true" />
  </span>
);

export const EmptyState = ({
  title,
  message,
  action,
}: {
  readonly title: string;
  readonly message: string;
  readonly action?: ReactNode;
}) => (
  <div className={styles.state}>
    <strong>{title}</strong>
    <span>{message}</span>
    {action}
  </div>
);

export const ErrorState = ({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <div className={styles.state}>
      <InlineAlert tone="error">{message}</InlineAlert>
      <Button tone="secondary" onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </div>
  );
};
