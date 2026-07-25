import { parseDate } from '@internationalized/date';

import {
  ABSOLUTE_MIN_DATE,
  type CalendarDateRange,
  validateDateRange,
} from '../../../shared/date/calendar-date-range';

export {
  ABSOLUTE_MIN_DATE,
  type CalendarDateRange,
} from '../../../shared/date/calendar-date-range';

export const parseAppliedDateRange = (
  searchParams: URLSearchParams,
  maxDate: CalendarDateRange['end'],
): CalendarDateRange | null => {
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  if (fromDate === null || toDate === null) return null;
  try {
    const value = { start: parseDate(fromDate), end: parseDate(toDate) };
    return validateDateRange({
      minDate: ABSOLUTE_MIN_DATE,
      maxDate,
      value,
    }).valid
      ? value
      : null;
  } catch {
    return null;
  }
};

export const applyDateSearchToParams = (
  current: URLSearchParams,
  range: CalendarDateRange,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  next.set('fromDate', range.start.toString());
  next.set('toDate', range.end.toString());
  return next;
};

export const clearDateSearchFromParams = (
  current: URLSearchParams,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  next.delete('fromDate');
  next.delete('toDate');
  return next;
};

export const sameDateRange = (
  left: CalendarDateRange | null,
  right: CalendarDateRange | null,
): boolean =>
  left === right ||
  (left !== null &&
    right !== null &&
    left.start.compare(right.start) === 0 &&
    left.end.compare(right.end) === 0);

export const toUtcDateRange = (
  range: CalendarDateRange,
  timeZone: string,
): { readonly from: string; readonly to: string } => ({
  from: range.start.toDate(timeZone).toISOString(),
  to: range.end.add({ days: 1 }).toDate(timeZone).toISOString(),
});
