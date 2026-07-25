import { z } from 'zod';

export const API_ERROR_CODES = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  TRANSACTION_NOT_POSTED: 'TRANSACTION_NOT_POSTED',
  TRANSACTION_ALREADY_REVERSED: 'TRANSACTION_ALREADY_REVERSED',
  REVERSAL_WINDOW_EXPIRED: 'REVERSAL_WINDOW_EXPIRED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
} as const;

export const apiErrorCodeSchema = z.enum([
  API_ERROR_CODES.INVALID_REQUEST,
  API_ERROR_CODES.INTERNAL_ERROR,
  API_ERROR_CODES.TRANSACTION_NOT_FOUND,
  API_ERROR_CODES.TRANSACTION_NOT_POSTED,
  API_ERROR_CODES.TRANSACTION_ALREADY_REVERSED,
  API_ERROR_CODES.REVERSAL_WINDOW_EXPIRED,
  API_ERROR_CODES.IDEMPOTENCY_CONFLICT,
]);

export const apiErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: apiErrorCodeSchema,
        message: z
          .string()
          .min(1)
          .refine((value) => value.trim().length > 0, {
            message: 'Error message must contain a non-whitespace character',
          }),
      })
      .strict(),
  })
  .strict();

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
