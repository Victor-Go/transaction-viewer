import { z } from 'zod';

import {
  InvalidGeneratedPageTokenError,
  InvalidPageTokenError,
} from '../application/errors/invalid-page-token.error.ts';
import {
  isValidAccountId,
  isValidTransactionId,
  type TransactionStatus,
} from '../domain/transaction.ts';

const PAGE_TOKEN_MAX_LENGTH = 2048;

const cursorSchema = z
  .object({
    v: z.literal(1),
    accountId: z.string().refine(isValidAccountId),
    status: z.enum(['pending', 'posted', 'reversed']).nullable(),
    transactionDate: z.iso.datetime(),
    id: z.string().refine(isValidTransactionId),
  })
  .strict();

interface CursorScope {
  readonly accountId: string;
  readonly status?: TransactionStatus;
}

interface CursorBoundary {
  readonly transactionDate: Date;
  readonly id: string;
}

export class TransactionCursorCodec {
  encode(scope: CursorScope & CursorBoundary): string {
    if (
      !isValidAccountId(scope.accountId) ||
      !isValidTransactionId(scope.id) ||
      Number.isNaN(scope.transactionDate.valueOf())
    ) {
      throw new InvalidGeneratedPageTokenError();
    }
    const token = Buffer.from(
      JSON.stringify({
        v: 1,
        accountId: scope.accountId,
        status: scope.status ?? null,
        transactionDate: scope.transactionDate.toISOString(),
        id: scope.id,
      }),
    ).toString('base64url');
    if (token.length > PAGE_TOKEN_MAX_LENGTH) {
      throw new InvalidGeneratedPageTokenError();
    }
    return token;
  }

  decode(token: string, scope: CursorScope): CursorBoundary {
    try {
      if (
        token.length < 1 ||
        token.length > PAGE_TOKEN_MAX_LENGTH ||
        !/^[A-Za-z0-9_-]+$/.test(token) ||
        !isValidAccountId(scope.accountId)
      ) {
        throw new InvalidPageTokenError();
      }
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const payload = cursorSchema.parse(JSON.parse(decoded));
      if (
        payload.accountId !== scope.accountId ||
        payload.status !== (scope.status ?? null)
      ) {
        throw new Error('scope mismatch');
      }
      const transactionDate = new Date(payload.transactionDate);
      if (
        Number.isNaN(transactionDate.valueOf()) ||
        transactionDate.toISOString() !== payload.transactionDate
      ) {
        throw new Error('invalid boundary');
      }
      return { transactionDate, id: payload.id };
    } catch {
      throw new InvalidPageTokenError();
    }
  }
}
