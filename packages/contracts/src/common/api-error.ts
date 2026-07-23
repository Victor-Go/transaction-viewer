import { z } from 'zod';

export const apiErrorCodeSchema = z.enum(['INVALID_REQUEST', 'INTERNAL_ERROR']);

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
