import { describe, expect, it } from 'vitest';

import { healthResponseSchema } from './health.ts';

describe('healthResponseSchema', () => {
  it('accepts the minimal healthy response', () => {
    expect(healthResponseSchema.parse({ status: 'ok' })).toEqual({
      status: 'ok',
    });
  });
});
