import { CalendarDate, type DateValue } from '@internationalized/date';

export interface CalendarDateRange {
  readonly start: CalendarDate;
  readonly end: CalendarDate;
}

export type CalendarDateDraft =
  | null
  | {
      readonly start: CalendarDate;
      readonly end: null;
    }
  | CalendarDateRange;

export const EMPTY_CALENDAR_DATE_DRAFT: CalendarDateDraft = null;

export const completeCalendarDateRange = (
  value: CalendarDateDraft,
): CalendarDateRange | null =>
  value === null || value.end === null ? null : value;

export const selectDraftDate = (
  value: CalendarDateDraft,
  clicked: CalendarDate,
): Exclude<CalendarDateDraft, null> => {
  if (value === null || value.end !== null) {
    return { start: clicked, end: null };
  }
  return clicked.compare(value.start) < 0
    ? { start: clicked, end: value.start }
    : { start: value.start, end: clicked };
};

export const ABSOLUTE_MIN_DATE = new CalendarDate(1970, 1, 1);
export const ABSOLUTE_MAX_DATE = new CalendarDate(9999, 12, 31);

const compare = (left: DateValue, right: DateValue): number =>
  left.compare(right);

export const validateDateRange = ({
  minDate,
  maxDate,
  value,
}: {
  readonly minDate: CalendarDate;
  readonly maxDate: CalendarDate;
  readonly value: CalendarDateRange | null;
}):
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string } => {
  if (compare(minDate, ABSOLUTE_MIN_DATE) < 0) {
    return { valid: false, reason: 'min-before-absolute-minimum' };
  }
  if (compare(maxDate, ABSOLUTE_MAX_DATE) > 0) {
    return { valid: false, reason: 'max-after-absolute-maximum' };
  }
  if (compare(maxDate, minDate) < 0) {
    return { valid: false, reason: 'max-before-min' };
  }
  if (value === null) return { valid: true };
  if (compare(value.start, value.end) > 0) {
    return { valid: false, reason: 'start-after-end' };
  }
  if (compare(value.start, minDate) < 0 || compare(value.end, maxDate) > 0) {
    return { valid: false, reason: 'selection-out-of-bounds' };
  }
  return { valid: true };
};
