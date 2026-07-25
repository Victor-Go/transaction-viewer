import express from 'express';
import { healthResponseSchema } from '@card-platform/contracts';

import {
  createGetTransactionHandler,
  createListTransactionsHandler,
  createTransactionHandler,
  reverseTransactionHandler,
  transactionErrorHandler,
  type CreateTransactionExecutor,
  type GetTransactionExecutor,
  type ListTransactionsExecutor,
  type ReverseTransactionExecutor,
} from './modules/transactions/http/transaction-http.ts';
import { LoggedTransactionCommand } from './modules/transactions/application/transaction-command-logging.ts';
import type { Clock } from './modules/transactions/application/ports/runtime-services.ts';
import type { Logger } from './shared/observability/logger.ts';

export interface AppDependencies {
  readonly listTransactions: ListTransactionsExecutor;
  readonly getTransaction: GetTransactionExecutor;
  readonly createTransaction: CreateTransactionExecutor;
  readonly reverseTransaction: ReverseTransactionExecutor;
  readonly clock: Clock;
  readonly logger: Logger;
}

export const createApp = ({
  listTransactions,
  getTransaction,
  createTransaction,
  reverseTransaction,
  clock,
  logger,
}: AppDependencies): express.Express => {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.json(healthResponseSchema.parse({ status: 'ok' }));
  });

  app.get(
    '/api/v1/accounts/:accountId/transactions',
    createListTransactionsHandler(listTransactions, clock),
  );
  app.get(
    '/api/v1/accounts/:accountId/transactions/:transactionId',
    createGetTransactionHandler(getTransaction, clock),
  );
  app.post(
    '/api/v1/accounts/:accountId/transactions',
    createTransactionHandler(
      new LoggedTransactionCommand(
        createTransaction,
        'create-transaction',
        logger,
      ),
      clock,
    ),
  );
  app.post(
    '/api/v1/accounts/:accountId/transactions/:transactionId/reversal',
    reverseTransactionHandler(
      new LoggedTransactionCommand(
        reverseTransaction,
        'reverse-transaction',
        logger,
      ),
      clock,
    ),
  );
  app.use(transactionErrorHandler(logger));

  return app;
};
