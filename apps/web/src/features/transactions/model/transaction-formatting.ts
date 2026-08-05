import { CREATE_TRANSACTION_MAX_MINOR_UNITS } from '@card-platform/contracts';
import type { CalendarDate } from '@internationalized/date';

import { calendarDateToLocalDate } from '../../../shared/date/calendar-date-adapter';

export type CadAmountParseResult =
  | { readonly success: true; readonly minorUnits: number }
  | { readonly success: false; readonly reason: 'invalid' | 'out-of-range' };

const CAD_INPUT_PATTERN = /^(?<whole>\d+)(?:[.,](?<fraction>\d{1,2}))?$/;
export const parseCadAmountInput = (input: string): CadAmountParseResult => {
  const normalized = input.trim();
  const match = CAD_INPUT_PATTERN.exec(normalized);
  if (!match?.groups) {
    return {
      success: false,
      reason: 'invalid',
    };
  }

  const whole = match.groups.whole ?? '';
  const fraction = (match.groups.fraction ?? '').padEnd(2, '0');
  const minorUnitsText = `${whole}${fraction}`;
  const minorUnits = Number(minorUnitsText);

  if (
    !Number.isSafeInteger(minorUnits) ||
    minorUnits <= 0 ||
    minorUnits > CREATE_TRANSACTION_MAX_MINOR_UNITS
  ) {
    return {
      success: false,
      reason: 'out-of-range',
    };
  }

  return { success: true, minorUnits };
};

export const formatCadAmount = (minorUnits: number, locale?: string): string =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);

export const formatLocalDateTime = (
  isoTimestamp: string,
  locale?: string,
  timeZone?: string,
): string =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timeZone === undefined ? {} : { timeZone }),
  }).format(new Date(isoTimestamp));

export const formatAppliedDateRange = (
  range: { readonly start: CalendarDate; readonly end: CalendarDate },
  locale: string,
  currentYear: number,
): string => {
  const includesYear =
    range.start.year !== currentYear || range.end.year !== currentYear;
  const startDate = calendarDateToLocalDate(range.start);
  const endDate = calendarDateToLocalDate(range.end);
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  });
  const start = dateFormatter.format(startDate);
  const end = dateFormatter.format(endDate);
  const isFrench = locale.startsWith('fr');

  if (range.start.compare(range.end) === 0) {
    if (!includesYear) return start;

    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(startDate);
  }

  if (
    range.start.year === range.end.year &&
    range.start.month === range.end.month
  ) {
    const parts = dateFormatter.formatToParts(startDate);
    const month = parts.find(({ type }) => type === 'month')?.value ?? '';
    const startDay = parts.find(({ type }) => type === 'day')?.value ?? '';
    const endDay = dateFormatter
      .formatToParts(endDate)
      .find(({ type }) => type === 'day')?.value;
    const year = includesYear
      ? new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(endDate)
      : null;

    if (isFrench) {
      return `${startDay} – ${endDay} ${month}${year === null ? '' : ` ${year}`}`;
    }

    return `${month} ${startDay} – ${endDay}${year === null ? '' : `, ${year}`}`;
  }

  if (!includesYear) return `${start} – ${end}`;

  if (range.start.year === range.end.year) {
    const year = new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(
      endDate,
    );
    const yearSeparator = isFrench ? ' ' : ', ';
    return `${start} – ${end}${yearSeparator}${year}`;
  }

  const fullDateFormatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${fullDateFormatter.format(startDate)} – ${fullDateFormatter.format(endDate)}`;
};
