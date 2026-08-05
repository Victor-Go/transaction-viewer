import { describe, expect, it } from 'vitest';

import { getReversalEligibility } from './reversal-eligibility';

describe('getReversalEligibility', () => {
  const deadline = '2026-07-24T12:00:00.000Z';

  it('allows the exact deadline when the server snapshot allows reversal', () => {
    expect(
      getReversalEligibility(true, deadline, new Date(deadline)),
    ).toMatchObject({ eligible: true, reason: 'eligible' });
  });

  it('fails closed one millisecond after the deadline', () => {
    expect(
      getReversalEligibility(
        true,
        deadline,
        new Date('2026-07-24T12:00:00.001Z'),
      ),
    ).toMatchObject({ eligible: false, reason: 'expired' });
  });

  it('fails closed when the deadline is malformed', () => {
    expect(
      getReversalEligibility(
        true,
        'not-a-date',
        new Date('2026-07-24T12:00:00.000Z'),
      ),
    ).toMatchObject({ eligible: false, reason: 'invalid-deadline' });
  });

  it('does not infer eligibility when the server disallows reversal', () => {
    expect(
      getReversalEligibility(false, deadline, new Date('2026-07-01T00:00:00Z')),
    ).toMatchObject({ eligible: false, reason: 'server-ineligible' });
  });
});
