import {
  API_ERROR_CODES,
  apiErrorResponseSchema,
  createTransactionRequestSchema,
  createTransactionResponseSchema,
  getTransactionPathParamsSchema,
  getTransactionResponseSchema,
  idempotencyKeySchema,
  listTransactionsPathParamsSchema,
  listTransactionsQuerySchema,
  listTransactionsResponseSchema,
  reverseTransactionPathParamsSchema,
  reverseTransactionRequestSchema,
  reverseTransactionResponseSchema,
} from '@card-platform/contracts';
import type { ErrorRequestHandler, Request, RequestHandler } from 'express';

import type {
  CreateTransactionInput,
  TransactionCommandResult,
} from '../application/create-transaction.ts';
import {
  IdempotencyConflictError,
  TransactionNotFoundError,
} from '../application/errors/transaction-command.error.ts';
import type { ListTransactionsInput } from '../application/list-transactions.ts';
import type { GetTransactionInput } from '../application/get-transaction.ts';
import type { ListTransactionsResult } from '../application/ports/transaction-repository.ts';
import type { Clock } from '../application/ports/runtime-services.ts';
import type {
  ReverseTransactionInput,
  ReverseTransactionResult,
} from '../application/reverse-transaction.ts';
import {
  ReversalWindowExpiredError,
  TransactionAlreadyReversedError,
  TransactionNotPostedError,
} from '../domain/transaction-policy.ts';
import type { Transaction } from '../domain/transaction.ts';
import { InvalidPageTokenError } from '../application/errors/invalid-page-token.error.ts';
import type { Logger } from '../../../shared/observability/logger.ts';
import { presentTransaction } from './transaction-presenter.ts';

class InvalidRequestError extends Error {}

const isJsonParseError = (error: unknown): boolean =>
  error instanceof SyntaxError &&
  typeof error === 'object' &&
  error !== null &&
  'body' in error;

const singleIdempotencyKey = (request: Request): string => {
  const headerValues: string[] = [];
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index]?.toLowerCase() === 'idempotency-key') {
      headerValues.push(request.rawHeaders[index + 1] ?? '');
    }
  }
  const result = idempotencyKeySchema.safeParse(
    headerValues.length === 1 ? headerValues[0] : undefined,
  );
  if (!result.success) {
    throw new InvalidRequestError();
  }
  return result.data;
};

export interface ListTransactionsExecutor {
  execute(input: ListTransactionsInput): Promise<ListTransactionsResult>;
}

export interface GetTransactionExecutor {
  execute(input: GetTransactionInput): Promise<Transaction>;
}

export interface CreateTransactionExecutor {
  execute(input: CreateTransactionInput): Promise<TransactionCommandResult>;
}

export interface ReverseTransactionExecutor {
  execute(input: ReverseTransactionInput): Promise<ReverseTransactionResult>;
}

export const createListTransactionsHandler = (
  listTransactions: ListTransactionsExecutor,
  clock: Clock,
): RequestHandler => {
  return async (request, response, next) => {
    try {
      const paramsResult = listTransactionsPathParamsSchema.safeParse(
        request.params,
      );
      const queryResult = listTransactionsQuerySchema.safeParse(request.query);
      if (!paramsResult.success || !queryResult.success) {
        throw new InvalidRequestError();
      }
      const params = paramsResult.data;
      const query = queryResult.data;
      const result = await listTransactions.execute({
        accountId: params.accountId,
        pageSize: query.pageSize,
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.pageToken === undefined
          ? {}
          : { pageToken: query.pageToken }),
      });
      const now = clock.now();
      response.json(
        listTransactionsResponseSchema.parse({
          data: result.transactions.map((transaction) =>
            presentTransaction(transaction, now),
          ),
          meta: {
            pageSize: result.pageSize,
            returnedCount: result.transactions.length,
            totalCount: result.totalCount,
            hasMore: result.hasMore,
            nextPageToken: result.nextPageToken,
          },
        }),
      );
    } catch (error) {
      next(error);
    }
  };
};

export const createGetTransactionHandler = (
  getTransaction: GetTransactionExecutor,
  clock: Clock,
): RequestHandler => {
  return async (request, response, next) => {
    try {
      const params = getTransactionPathParamsSchema.safeParse(request.params);
      if (!params.success) {
        throw new InvalidRequestError();
      }
      const transaction = await getTransaction.execute(params.data);
      response.json(
        getTransactionResponseSchema.parse({
          data: presentTransaction(transaction, clock.now()),
        }),
      );
    } catch (error) {
      next(error);
    }
  };
};

export const createTransactionHandler = (
  createTransaction: CreateTransactionExecutor,
  clock: Clock,
): RequestHandler => {
  return async (request, response, next) => {
    try {
      const params = listTransactionsPathParamsSchema.safeParse(request.params);
      const body = createTransactionRequestSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        throw new InvalidRequestError();
      }
      const result = await createTransaction.execute({
        accountId: params.data.accountId,
        idempotencyKey: singleIdempotencyKey(request),
        merchantName: body.data.merchantName,
        amount: body.data.amount,
      });
      response
        .status(201)
        .location(
          `/api/v1/accounts/${encodeURIComponent(
            params.data.accountId,
          )}/transactions/${encodeURIComponent(result.transaction.id)}`,
        )
        .json(
          createTransactionResponseSchema.parse({
            data: presentTransaction(result.transaction, clock.now()),
          }),
        );
    } catch (error) {
      next(error);
    }
  };
};

export const reverseTransactionHandler = (
  reverseTransaction: ReverseTransactionExecutor,
  clock: Clock,
): RequestHandler => {
  return async (request, response, next) => {
    try {
      const params = reverseTransactionPathParamsSchema.safeParse(
        request.params,
      );
      const body = reverseTransactionRequestSchema.safeParse(
        request.body ?? {},
      );
      if (!params.success || !body.success) {
        throw new InvalidRequestError();
      }
      const result = await reverseTransaction.execute({
        accountId: params.data.accountId,
        transactionId: params.data.transactionId,
        idempotencyKey: singleIdempotencyKey(request),
      });
      response.json(
        reverseTransactionResponseSchema.parse({
          data: presentTransaction(result.transaction, clock.now()),
        }),
      );
    } catch (error) {
      next(error);
    }
  };
};

const expectedErrorMapping = (
  error: unknown,
): {
  readonly status: number;
  readonly code: string;
  readonly message: string;
} | null => {
  if (
    error instanceof InvalidRequestError ||
    error instanceof InvalidPageTokenError ||
    isJsonParseError(error)
  ) {
    return {
      status: 400,
      code: API_ERROR_CODES.INVALID_REQUEST,
      message: 'The request is invalid.',
    };
  }
  if (error instanceof TransactionNotFoundError) {
    return {
      status: 404,
      code: API_ERROR_CODES.TRANSACTION_NOT_FOUND,
      message: 'The transaction was not found.',
    };
  }
  if (error instanceof TransactionNotPostedError) {
    return {
      status: 409,
      code: API_ERROR_CODES.TRANSACTION_NOT_POSTED,
      message: 'The transaction is not posted.',
    };
  }
  if (error instanceof TransactionAlreadyReversedError) {
    return {
      status: 409,
      code: API_ERROR_CODES.TRANSACTION_ALREADY_REVERSED,
      message: 'The transaction has already been reversed.',
    };
  }
  if (error instanceof ReversalWindowExpiredError) {
    return {
      status: 409,
      code: API_ERROR_CODES.REVERSAL_WINDOW_EXPIRED,
      message: 'The reversal window has expired.',
    };
  }
  if (error instanceof IdempotencyConflictError) {
    return {
      status: 409,
      code: API_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      message: 'The idempotency key conflicts with an earlier request.',
    };
  }
  return null;
};

export const transactionErrorHandler =
  (logger: Logger): ErrorRequestHandler =>
  (error, request, response, _next) => {
    void _next;
    const expected = expectedErrorMapping(error);
    if (expected === null) {
      logger.error(
        {
          err: {
            type:
              error instanceof Error ? error.constructor.name : 'UnknownError',
          },
          component: 'transaction-http',
          method: request.method,
          route: request.route?.path ?? 'unknown',
          statusCode: 500,
          errorCategory: 'unexpected',
        },
        'Unexpected HTTP failure',
      );
    }
    response.status(expected?.status ?? 500).json(
      apiErrorResponseSchema.parse({
        error: {
          code: expected?.code ?? API_ERROR_CODES.INTERNAL_ERROR,
          message: expected?.message ?? 'An internal error occurred.',
        },
      }),
    );
  };
