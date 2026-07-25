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

  if (!Number.isSafeInteger(minorUnits) || minorUnits <= 0) {
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
  const formatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(includesYear ? { year: 'numeric' } : {}),
  });

  return formatter.formatRange(
    calendarDateToLocalDate(range.start),
    calendarDateToLocalDate(range.end),
  );
};
import type { CalendarDate } from '@internationalized/date';

import { calendarDateToLocalDate } from '../../../shared/date/calendar-date-adapter';
