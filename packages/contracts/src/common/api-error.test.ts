import { describe, expect, it } from 'vitest';

import {
  API_ERROR_CODES,
  apiErrorCodeSchema,
  apiErrorResponseSchema,
} from './api-error.ts';

describe('apiErrorCodeSchema', () => {
  it('accepts every value in the shared API error-code registry', () => {
    expect(
      Object.values(API_ERROR_CODES).map((code) =>
        apiErrorCodeSchema.parse(code),
      ),
    ).toEqual(Object.values(API_ERROR_CODES));
  });
  it.each([
    'INVALID_REQUEST',
    'INTERNAL_ERROR',
    'TRANSACTION_NOT_FOUND',
    'TRANSACTION_NOT_POSTED',
    'TRANSACTION_ALREADY_REVERSED',
    'REVERSAL_WINDOW_EXPIRED',
    'IDEMPOTENCY_CONFLICT',
  ])('accepts the public error code %s', (code) => {
    expect(apiErrorCodeSchema.parse(code)).toBe(code);
  });

  it('rejects error codes outside the current public contract', () => {
    expect(apiErrorCodeSchema.safeParse('NOT_A_REAL_ERROR_CODE').success).toBe(
      false,
    );
  });
});

describe('apiErrorResponseSchema', () => {
  it('accepts a contract-shaped error response', () => {
    const response = {
      error: {
        code: 'INVALID_REQUEST',
        message: 'The request is invalid.',
      },
    };

    expect(apiErrorResponseSchema.parse(response)).toEqual(response);
  });

  it.each(['', '   '])('rejects the invalid message %j', (message) => {
    expect(
      apiErrorResponseSchema.safeParse({
        error: {
          code: 'INTERNAL_ERROR',
          message,
        },
      }).success,
    ).toBe(false);
  });

  it('does not trim a non-blank message', () => {
    const response = {
      error: {
        code: 'INTERNAL_ERROR',
        message: '  A human-readable message.  ',
      },
    };

    expect(apiErrorResponseSchema.parse(response)).toEqual(response);
  });

  it('rejects an error response with an unknown code', () => {
    const result = apiErrorResponseSchema.safeParse({
      error: {
        code: 'NOT_A_REAL_ERROR_CODE',
        message: 'Unknown error.',
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects undeclared response fields', () => {
    expect(
      apiErrorResponseSchema.safeParse({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred.',
        },
        requestId: 'request-001',
      }).success,
    ).toBe(false);
  });
});
