import { describe, expect, it, vi } from 'vitest';

import {
  beginIdempotentAttempt,
  completeIdempotentAttempt,
  createIdempotentAttempt,
} from './idempotency-attempt';

describe('idempotency attempt lifecycle', () => {
  it('reuses a key after an uncertain result', () => {
    const keyFactory = vi.fn(() => 'key-one');
    const started = beginIdempotentAttempt(
      createIdempotentAttempt(),
      'merchant|2599',
      keyFactory,
    );
    const uncertain = completeIdempotentAttempt(started, 'uncertain');
    const retried = beginIdempotentAttempt(
      uncertain,
      'merchant|2599',
      keyFactory,
    );

    expect(retried.key).toBe('key-one');
    expect(keyFactory).toHaveBeenCalledOnce();
  });

  it('generates a new key when semantic input changes', () => {
    const keyFactory = vi
      .fn<() => string>()
      .mockReturnValueOnce('key-one')
      .mockReturnValueOnce('key-two');
    const started = beginIdempotentAttempt(
      createIdempotentAttempt(),
      'merchant|2599',
      keyFactory,
    );
    const changed = beginIdempotentAttempt(
      completeIdempotentAttempt(started, 'uncertain'),
      'other|2599',
      keyFactory,
    );

    expect(changed.key).toBe('key-two');
  });

  it('does not retain a key after an explicit rejection or success', () => {
    const started = beginIdempotentAttempt(
      createIdempotentAttempt(),
      'merchant|2599',
      () => 'key-one',
    );

    expect(completeIdempotentAttempt(started, 'rejected').key).toBeNull();
    expect(completeIdempotentAttempt(started, 'success').key).toBeNull();
  });
});
