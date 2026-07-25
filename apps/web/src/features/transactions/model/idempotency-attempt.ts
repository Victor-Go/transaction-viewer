export type AttemptOutcome = 'success' | 'rejected' | 'uncertain';

export interface IdempotentAttempt {
  readonly intent: string | null;
  readonly key: string | null;
  readonly uncertain: boolean;
}

export const createIdempotentAttempt = (): IdempotentAttempt => ({
  intent: null,
  key: null,
  uncertain: false,
});

export const beginIdempotentAttempt = (
  state: IdempotentAttempt,
  intent: string,
  keyFactory: () => string,
): IdempotentAttempt => {
  if (state.intent === intent && state.key !== null && state.uncertain) {
    return { ...state, uncertain: false };
  }
  return { intent, key: keyFactory(), uncertain: false };
};

export const completeIdempotentAttempt = (
  state: IdempotentAttempt,
  outcome: AttemptOutcome,
): IdempotentAttempt =>
  outcome === 'uncertain'
    ? { ...state, uncertain: true }
    : createIdempotentAttempt();
