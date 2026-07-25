import { parseDate } from '@internationalized/date';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type CalendarDateDraft,
  type CalendarDateRange,
  completeCalendarDateRange,
  validateDateRange,
} from '../../../shared/date/calendar-date-range';
import { Dialog } from '../../../shared/overlays/Dialog';
import type {
  OverlayLayer,
  TransactionDateSearchOverlayRequest,
} from '../../../shared/overlays/overlay-types';
import { Button } from '../../../shared/ui/Button';
import { DateRangePicker } from '../../../shared/ui/DateRangePicker';
import styles from './TransactionDateSearchDialog.module.scss';

const parseRange = (
  value: NonNullable<TransactionDateSearchOverlayRequest['appliedValue']>,
): CalendarDateRange => ({
  start: parseDate(value.start),
  end: parseDate(value.end),
});

export const TransactionDateSearchDialog = ({
  request,
  layer,
  open = true,
  onClose,
  onExited,
}: {
  readonly request: TransactionDateSearchOverlayRequest;
  readonly layer: OverlayLayer;
  readonly open?: boolean;
  readonly onClose: () => void;
  readonly onExited?: () => void;
}) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<CalendarDateDraft>(() =>
    request.appliedValue === null ? null : parseRange(request.appliedValue),
  );
  const [searching, setSearching] = useState(false);
  const minDate = useMemo(() => parseDate(request.minDate), [request.minDate]);
  const maxDate = useMemo(() => parseDate(request.maxDate), [request.maxDate]);
  const initialVisibleMonth = useMemo(
    () => parseDate(request.initialVisibleMonth),
    [request.initialVisibleMonth],
  );
  const completeRange = completeCalendarDateRange(draft);
  const validity = validateDateRange({
    minDate,
    maxDate,
    value: completeRange,
  });
  const errorMessage =
    completeRange !== null && !validity.valid
      ? t('dateSearch.invalid')
      : undefined;

  const search = () => {
    if (searching || completeRange === null || !validity.valid) return;
    setSearching(true);
    request.onSearch({
      start: completeRange.start.toString(),
      end: completeRange.end.toString(),
    });
    onClose();
  };

  return (
    <Dialog
      title={t('dateSearch.title')}
      description={t('dateSearch.description')}
      closeLabel={t('dateSearch.close')}
      layer={layer}
      open={open}
      dismissible={!searching}
      onClose={onClose}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        document.getElementById('date-search-control')?.focus();
      }}
      {...(onExited === undefined ? {} : { onExited })}
      actions={
        <>
          <Button tone="secondary" onClick={onClose} disabled={searching}>
            {t('dateSearch.cancel')}
          </Button>
          <Button
            onClick={search}
            loading={searching}
            disabled={completeRange === null || !validity.valid}
          >
            {t('dateSearch.search')}
          </Button>
        </>
      }
    >
      <div className={styles.content}>
        <DateRangePicker
          value={draft}
          onChange={setDraft}
          initialVisibleMonth={initialVisibleMonth}
          minDate={minDate}
          maxDate={maxDate}
          locale={request.locale}
          isDisabled={searching}
          {...(errorMessage === undefined ? {} : { errorMessage })}
          labels={{
            range: t('dateSearch.title'),
            start: t('dateSearch.start'),
            end: t('dateSearch.end'),
            selectStart: t('dateSearch.selectStart'),
            selectEnd: t('dateSearch.selectEnd'),
            previousYear: t('dateSearch.previousYear'),
            previousMonth: t('dateSearch.previousMonth'),
            nextMonth: t('dateSearch.nextMonth'),
            nextYear: t('dateSearch.nextYear'),
            configurationError: t('dateSearch.configurationError'),
          }}
        />
      </div>
    </Dialog>
  );
};
