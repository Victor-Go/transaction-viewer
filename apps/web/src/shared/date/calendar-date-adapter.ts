import { CalendarDate } from '@internationalized/date';

/**
 * Carries a calendar-only value through APIs that require a JavaScript Date.
 * Local midday avoids UTC-midnight and daylight-saving boundary shifts.
 */
export const calendarDateToLocalDate = (value: CalendarDate): Date =>
  new Date(value.year, value.month - 1, value.day, 12);

export const localDateToCalendarDate = (value: Date): CalendarDate =>
  new CalendarDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
