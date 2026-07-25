import { CalendarDate } from '@internationalized/date';
import { describe, expect, it } from 'vitest';

import {
  ABSOLUTE_MAX_DATE,
  ABSOLUTE_MIN_DATE,
  selectDraftDate,
  validateDateRange,
} from './calendar-date-range';

const afterAbsoluteMaximum = new CalendarDate(9999, 1, 1);
Object.defineProperty(afterAbsoluteMaximum, 'year', { value: 10_000 });

describe('shared calendar-date range validation', () => {
  it.each([
    [
      'minimum below the supported bound',
      new CalendarDate(1969, 12, 31),
      ABSOLUTE_MAX_DATE,
      null,
    ],
    [
      'maximum above the supported bound',
      ABSOLUTE_MIN_DATE,
      afterAbsoluteMaximum,
      null,
    ],
    [
      'maximum before minimum',
      new CalendarDate(2026, 2, 1),
      new CalendarDate(2026, 1, 1),
      null,
    ],
    [
      'start after end',
      ABSOLUTE_MIN_DATE,
      ABSOLUTE_MAX_DATE,
      {
        start: new CalendarDate(2026, 2, 2),
        end: new CalendarDate(2026, 2, 1),
      },
    ],
    [
      'selection outside bounds',
      new CalendarDate(2026, 1, 1),
      new CalendarDate(2026, 2, 1),
      {
        start: new CalendarDate(2025, 12, 31),
        end: new CalendarDate(2026, 2, 2),
      },
    ],
  ])('rejects a %s', (_name, minDate, maxDate, value) => {
    expect(validateDateRange({ minDate, maxDate, value }).valid).toBe(false);
  });

  it('accepts an empty draft and a complete inclusive range in bounds', () => {
    expect(
      validateDateRange({
        minDate: ABSOLUTE_MIN_DATE,
        maxDate: new CalendarDate(2026, 7, 24),
        value: null,
      }),
    ).toEqual({ valid: true });
    expect(
      validateDateRange({
        minDate: ABSOLUTE_MIN_DATE,
        maxDate: new CalendarDate(2026, 7, 24),
        value: {
          start: new CalendarDate(2026, 6, 1),
          end: new CalendarDate(2026, 7, 24),
        },
      }),
    ).toEqual({ valid: true });
  });
});

describe('selectDraftDate', () => {
  const a = new CalendarDate(2026, 6, 10);
  const later = new CalendarDate(2026, 7, 2);
  const earlier = new CalendarDate(2026, 5, 31);

  it('starts an incomplete range from an empty draft', () => {
    expect(selectDraftDate(null, a)).toEqual({ start: a, end: null });
  });

  it('completes later, earlier, and same-day second selections', () => {
    expect(selectDraftDate({ start: a, end: null }, later)).toEqual({
      start: a,
      end: later,
    });
    expect(selectDraftDate({ start: a, end: null }, earlier)).toEqual({
      start: earlier,
      end: a,
    });
    expect(selectDraftDate({ start: a, end: null }, a)).toEqual({
      start: a,
      end: a,
    });
  });

  it('atomically starts a new range after a complete range', () => {
    const complete = { start: earlier, end: later };

    expect(selectDraftDate(complete, a)).toEqual({ start: a, end: null });
    expect(complete).toEqual({ start: earlier, end: later });
  });

  it('compares dates across years', () => {
    const newYear = new CalendarDate(2027, 1, 1);

    expect(selectDraftDate({ start: newYear, end: null }, earlier)).toEqual({
      start: earlier,
      end: newYear,
    });
  });
});
