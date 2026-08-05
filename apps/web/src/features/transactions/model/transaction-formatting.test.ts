import { CalendarDate } from '@internationalized/date';
import { describe, expect, it } from 'vitest';

import {
  formatAppliedDateRange,
  formatCadAmount,
  formatLocalDateTime,
  parseCadAmountInput,
} from './transaction-formatting';

describe('parseCadAmountInput', () => {
  it.each([
    ['25', 2500],
    ['25.9', 2590],
    ['25.99', 2599],
    ['25,99', 2599],
    ['0.01', 1],
    ['999999999.99', 99999999999],
  ])('parses %s exactly as %d minor units', (input, minorUnits) => {
    expect(parseCadAmountInput(input)).toEqual({
      success: true,
      minorUnits,
    });
  });

  it.each([
    '',
    '0',
    '0.00',
    '-1',
    '25.999',
    '1e2',
    '2,5.0',
    '2.',
    '.25',
    '12 dollars',
    '1000000000.00',
    '90071992547409.92',
  ])('rejects the invalid or unsafe amount %j', (input) => {
    expect(parseCadAmountInput(input).success).toBe(false);
  });
});

describe('transaction formatting', () => {
  it('formats CAD from minor units without converting currency', () => {
    expect(formatCadAmount(2599, 'en-CA')).toBe('$25.99');
  });

  it('formats an ISO timestamp deterministically with an injected timezone', () => {
    expect(
      formatLocalDateTime('2026-07-20T18:30:00.000Z', 'en-CA', 'UTC'),
    ).toContain('Jul 20, 2026');
  });

  it.each([
    [
      'current-year English range',
      'en-CA',
      new CalendarDate(2026, 6, 1),
      new CalendarDate(2026, 7, 24),
      2026,
      'Jun 1 – Jul 24',
    ],
    [
      'historical English range',
      'en-CA',
      new CalendarDate(2025, 6, 1),
      new CalendarDate(2025, 7, 24),
      2026,
      'Jun 1 – Jul 24, 2025',
    ],
    [
      'cross-year English range',
      'en-CA',
      new CalendarDate(2025, 12, 31),
      new CalendarDate(2026, 1, 2),
      2026,
      'Dec 31, 2025 – Jan 2, 2026',
    ],
    [
      'current-year French range',
      'fr-CA',
      new CalendarDate(2026, 6, 1),
      new CalendarDate(2026, 7, 24),
      2026,
      '1 juin – 24 juill.',
    ],
    [
      'historical French range',
      'fr-CA',
      new CalendarDate(2025, 6, 1),
      new CalendarDate(2025, 7, 24),
      2026,
      '1 juin – 24 juill. 2025',
    ],
    [
      'cross-year French range',
      'fr-CA',
      new CalendarDate(2025, 12, 31),
      new CalendarDate(2026, 1, 2),
      2026,
      '31 déc. 2025 – 2 janv. 2026',
    ],
  ])(
    'formats an applied %s with an injected current year',
    (_name, locale, start, end, currentYear, expected) => {
      expect(formatAppliedDateRange({ start, end }, locale, currentYear)).toBe(
        expected,
      );
    },
  );
});
