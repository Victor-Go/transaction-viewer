import { z } from 'zod';

export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

export const idempotencyKeySchema = z
  .string()
  .min(1)
  .max(IDEMPOTENCY_KEY_MAX_LENGTH)
  .refine((value) => value.trim() === value, {
    message: 'Idempotency key must not have surrounding whitespace',
  });

export type IdempotencyKey = z.infer<typeof idempotencyKeySchema>;
