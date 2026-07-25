export type ReversalEligibility =
  | {
      readonly eligible: true;
      readonly reason: 'eligible';
      readonly expiresAt: Date;
    }
  | {
      readonly eligible: false;
      readonly reason: 'server-ineligible' | 'invalid-deadline' | 'expired';
      readonly expiresAt: Date | null;
    };

export const getReversalEligibility = (
  canReverse: boolean,
  reverseExpiresAt: string,
  now: Date,
): ReversalEligibility => {
  const timestamp = Date.parse(reverseExpiresAt);
  if (!Number.isFinite(timestamp)) {
    return {
      eligible: false,
      reason: 'invalid-deadline',
      expiresAt: null,
    };
  }

  const expiresAt = new Date(timestamp);
  if (!canReverse) {
    return {
      eligible: false,
      reason: 'server-ineligible',
      expiresAt,
    };
  }

  if (now.getTime() > timestamp) {
    return { eligible: false, reason: 'expired', expiresAt };
  }

  return { eligible: true, reason: 'eligible', expiresAt };
};
