import { CalendarDate } from '@internationalized/date';
import { describe, expect, it } from 'vitest';

import {
  applyDateSearchToParams,
  clearDateSearchFromParams,
  parseAppliedDateRange,
  sameDateRange,
  toUtcDateRange,
} from './date-range';

describe('applied date search URL state', () => {
  const maxDate = new CalendarDate(2026, 7, 24);

  it('parses only a complete valid local-calendar range', () => {
    expect(
      parseAppliedDateRange(
        new URLSearchParams(
          'status=posted&fromDate=2026-06-01&toDate=2026-07-24',
        ),
        maxDate,
      ),
    ).toEqual({
      start: new CalendarDate(2026, 6, 1),
      end: new CalendarDate(2026, 7, 24),
    });
    expect(
      parseAppliedDateRange(
        new URLSearchParams('fromDate=2026-06-01'),
        maxDate,
      ),
    ).toBeNull();
    expect(
      parseAppliedDateRange(
        new URLSearchParams('fromDate=2026-07-25&toDate=2026-07-26'),
        maxDate,
      ),
    ).toBeNull();
  });

  it('applies both dates while preserving status and unrelated parameters', () => {
    const result = applyDateSearchToParams(
      new URLSearchParams('status=posted&future=value'),
      {
        start: new CalendarDate(2026, 6, 1),
        end: new CalendarDate(2026, 7, 24),
      },
    );

    expect(result.toString()).toBe(
      'status=posted&future=value&fromDate=2026-06-01&toDate=2026-07-24',
    );
  });

  it('clears only date parameters', () => {
    const result = clearDateSearchFromParams(
      new URLSearchParams(
        'status=posted&fromDate=2026-06-01&toDate=2026-07-24&future=value',
      ),
    );

    expect(result.toString()).toBe('status=posted&future=value');
  });

  it('recognizes an identical applied range', () => {
    const range = {
      start: new CalendarDate(2026, 6, 1),
      end: new CalendarDate(2026, 7, 24),
    };
    expect(sameDateRange(range, { ...range })).toBe(true);
    expect(
      sameDateRange(range, {
        start: range.start,
        end: range.end.subtract({ days: 1 }),
      }),
    ).toBe(false);
  });
});

describe('toUtcDateRange', () => {
  it('uses local midnights and an exclusive next-day boundary across DST', () => {
    expect(
      toUtcDateRange(
        {
          start: new CalendarDate(2026, 3, 8),
          end: new CalendarDate(2026, 3, 9),
        },
        'America/Los_Angeles',
      ),
    ).toEqual({
      from: '2026-03-08T08:00:00.000Z',
      to: '2026-03-10T07:00:00.000Z',
    });
  });
});
