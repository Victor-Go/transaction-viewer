import type { TransactionStatus } from '@card-platform/contracts';
import { useTranslation } from 'react-i18next';

import styles from './StatusBadge.module.scss';

export const StatusBadge = ({
  status,
}: {
  readonly status: TransactionStatus;
}) => {
  const { t } = useTranslation();
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      {t(`status.${status}`)}
    </span>
  );
};
