import { CalendarDate } from '@internationalized/date';
import { describe, expect, it } from 'vitest';

import {
  calendarDateToLocalDate,
  localDateToCalendarDate,
} from './calendar-date-adapter';

describe('CalendarDate and local Date adapter', () => {
  it.each([
    new CalendarDate(2026, 3, 8),
    new CalendarDate(2026, 11, 1),
    new CalendarDate(2025, 12, 31),
    new CalendarDate(2026, 1, 1),
  ])('round-trips $year-$month-$day without shifting the day', (value) => {
    const localDate = calendarDateToLocalDate(value);

    expect(localDate.getHours()).toBe(12);
    expect(localDateToCalendarDate(localDate)).toEqual(value);
  });
});
