import type { CalendarDate } from '@internationalized/date';
import { useId, useState } from 'react';
import { DayButton, DayPicker, type DayButtonProps } from 'react-day-picker';
import { enCA, frCA } from 'react-day-picker/locale';

import {
  calendarDateToLocalDate,
  localDateToCalendarDate,
} from '../date/calendar-date-adapter';
import {
  type CalendarDateDraft,
  completeCalendarDateRange,
  selectDraftDate,
  validateDateRange,
} from '../date/calendar-date-range';
import styles from './DateRangePicker.module.scss';

const css = (name: keyof typeof styles): string => styles[name] ?? '';

export interface DateRangePickerProps {
  readonly value: CalendarDateDraft;
  readonly onChange: (value: CalendarDateDraft) => void;
  readonly initialVisibleMonth: CalendarDate;
  readonly minDate: CalendarDate;
  readonly maxDate: CalendarDate;
  readonly locale: string;
  readonly isDisabled?: boolean;
  readonly errorMessage?: string;
  readonly labels: {
    readonly range: string;
    readonly start: string;
    readonly end: string;
    readonly selectStart: string;
    readonly selectEnd: string;
    readonly previousYear: string;
    readonly previousMonth: string;
    readonly nextMonth: string;
    readonly nextYear: string;
    readonly configurationError: string;
  };
}

const SemanticDayButton = ({
  day,
  modifiers,
  onKeyDown,
  ...buttonProps
}: DayButtonProps) => {
  const date = localDateToCalendarDate(day.date);

  return (
    <DayButton
      {...buttonProps}
      day={day}
      modifiers={modifiers}
      data-date={date.toString()}
      data-current-month={!modifiers.outside || undefined}
      data-outside-month={modifiers.outside || undefined}
      data-disabled={modifiers.disabled || undefined}
      data-selected={modifiers.selected || undefined}
      data-selection-start={
        modifiers.range_start || modifiers.draft_start || undefined
      }
      data-range-middle={modifiers.range_middle || undefined}
      data-selection-end={modifiers.range_end || undefined}
      data-today={modifiers.today || undefined}
      onKeyDown={(event) => {
        const offsets: Partial<Record<string, number>> = {
          ArrowLeft: -1,
          ArrowRight: 1,
          ArrowUp: -7,
          ArrowDown: 7,
        };
        const offset = offsets[event.key];
        if (offset === undefined) {
          onKeyDown?.(event);
          return;
        }
        const targetDate = date.add({ days: offset }).toString();
        const target = event.currentTarget
          .closest('[role="grid"]')
          ?.querySelector<HTMLButtonElement>(
            `[data-date="${targetDate}"]:not(:disabled)`,
          );
        if (target === null || target === undefined) {
          onKeyDown?.(event);
          return;
        }
        if (!modifiers.outside && !target.hasAttribute('data-outside-month')) {
          onKeyDown?.(event);
          return;
        }
        event.preventDefault();
        target.focus();
      }}
    />
  );
};

const compareMonths = (left: CalendarDate, right: CalendarDate): number =>
  left.year === right.year ? left.month - right.month : left.year - right.year;

const firstOfMonth = (value: CalendarDate): CalendarDate =>
  value.set({ day: 1 });

const formatSummaryDate = (date: CalendarDate, locale: string): string =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
    calendarDateToLocalDate(date),
  );

export const DateRangePicker = ({
  value,
  onChange,
  initialVisibleMonth,
  minDate,
  maxDate,
  locale,
  isDisabled = false,
  errorMessage,
  labels,
}: DateRangePickerProps) => {
  const errorId = useId();
  const [displayedMonth, setDisplayedMonth] = useState(() =>
    firstOfMonth(initialVisibleMonth),
  );
  const completeRange = completeCalendarDateRange(value);
  const configuration = validateDateRange({
    minDate,
    maxDate,
    value: completeRange,
  });
  const isStart = (date: Date) =>
    value !== null && localDateToCalendarDate(date).compare(value.start) === 0;
  const isEnd = (date: Date) =>
    value?.end !== null &&
    value !== null &&
    localDateToCalendarDate(date).compare(value.end) === 0;
  const isRangeMiddle = (date: Date) => {
    if (value?.end === null || value === null) return false;
    const calendarDate = localDateToCalendarDate(date);
    return (
      calendarDate.compare(value.start) > 0 &&
      calendarDate.compare(value.end) < 0
    );
  };
  const isSelected = (date: Date) =>
    isStart(date) || isEnd(date) || isRangeMiddle(date);
  const minimumMonth = firstOfMonth(minDate);
  const maximumMonth = firstOfMonth(maxDate);
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(calendarDateToLocalDate(displayedMonth));
  const dayPickerLocale = locale === 'fr-CA' ? frCA : enCA;
  const startSummary =
    value === null
      ? labels.selectStart
      : formatSummaryDate(value.start, locale);
  const endSummary =
    value?.end === null || value === null
      ? labels.selectEnd
      : formatSummaryDate(value.end, locale);

  if (!configuration.valid) {
    return <div role="alert">{labels.configurationError}</div>;
  }

  const navigate = (duration: { months?: number; years?: number }) => {
    setDisplayedMonth((month) => firstOfMonth(month.add(duration)));
  };
  const previousYear = displayedMonth.subtract({ years: 1 });
  const previousMonth = displayedMonth.subtract({ months: 1 });
  const nextMonth = displayedMonth.add({ months: 1 });
  const nextYear = displayedMonth.add({ years: 1 });

  return (
    <div
      className={css('root')}
      aria-label={labels.range}
      aria-describedby={errorMessage === undefined ? undefined : errorId}
    >
      <dl className={styles.summaries}>
        <div className={styles.summary}>
          <dt>{labels.start}</dt>
          <dd>{startSummary}</dd>
        </div>
        <div className={styles.summary}>
          <dt>{labels.end}</dt>
          <dd>{endSummary}</dd>
        </div>
      </dl>

      <div className={styles.calendarHeader}>
        <button
          type="button"
          className={styles.calendarButton}
          aria-label={labels.previousYear}
          disabled={isDisabled || compareMonths(previousYear, minimumMonth) < 0}
          onClick={() => navigate({ years: -1 })}
        >
          «
        </button>
        <button
          type="button"
          className={styles.calendarButton}
          aria-label={labels.previousMonth}
          disabled={
            isDisabled || compareMonths(previousMonth, minimumMonth) < 0
          }
          onClick={() => navigate({ months: -1 })}
        >
          ‹
        </button>
        <h3 className={styles.month} aria-live="polite">
          {monthLabel}
        </h3>
        <button
          type="button"
          className={styles.calendarButton}
          aria-label={labels.nextMonth}
          disabled={isDisabled || compareMonths(nextMonth, maximumMonth) > 0}
          onClick={() => navigate({ months: 1 })}
        >
          ›
        </button>
        <button
          type="button"
          className={styles.calendarButton}
          aria-label={labels.nextYear}
          disabled={isDisabled || compareMonths(nextYear, maximumMonth) > 0}
          onClick={() => navigate({ years: 1 })}
        >
          »
        </button>
      </div>

      <DayPicker
        month={calendarDateToLocalDate(displayedMonth)}
        onDayClick={(date, modifiers) => {
          if (isDisabled || modifiers.disabled || modifiers.hidden) return;
          onChange(selectDraftDate(value, localDateToCalendarDate(date)));
        }}
        fixedWeeks
        showOutsideDays
        hideNavigation
        disabled={
          isDisabled
            ? [true]
            : [
                { before: calendarDateToLocalDate(minDate) },
                { after: calendarDateToLocalDate(maxDate) },
              ]
        }
        locale={dayPickerLocale}
        aria-label={labels.range}
        labels={{ labelGrid: () => labels.range }}
        modifiers={{
          selected: isSelected,
          draft_start: value !== null && value.end === null ? isStart : [],
          range_start: completeRange === null ? [] : isStart,
          range_middle: completeRange === null ? [] : isRangeMiddle,
          range_end: completeRange === null ? [] : isEnd,
        }}
        modifiersClassNames={{
          selected: css('selected'),
          draft_start: css('draftStart'),
          range_start: css('rangeStart'),
          range_middle: css('rangeMiddle'),
          range_end: css('rangeEnd'),
        }}
        components={{
          DayButton: SemanticDayButton,
          MonthCaption: () => <></>,
        }}
        classNames={{
          root: css('calendar'),
          months: css('months'),
          month: css('calendarMonth'),
          month_grid: css('grid'),
          weekdays: css('weekdays'),
          weekday: css('weekday'),
          weeks: css('weeks'),
          week: css('week'),
          day: css('day'),
          day_button: css('dayButton'),
          outside: css('outside'),
          disabled: css('disabled'),
          focused: css('focused'),
          today: css('today'),
        }}
      />

      {errorMessage ? (
        <p id={errorId} className={styles.error} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
};
