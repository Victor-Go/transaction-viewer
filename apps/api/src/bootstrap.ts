import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from './app.ts';
import { ListTransactions } from './modules/transactions/application/list-transactions.ts';
import { GetTransaction } from './modules/transactions/application/get-transaction.ts';
import { CreateTransaction } from './modules/transactions/application/create-transaction.ts';
import { PostPendingTransactions } from './modules/transactions/application/post-pending-transactions.ts';
import { ReverseTransaction } from './modules/transactions/application/reverse-transaction.ts';
import {
  createTransactionDatabase,
  initializeTransactionDatabase,
} from './modules/transactions/infrastructure/transaction-database.ts';
import { JsonTransactionRepository } from './modules/transactions/infrastructure/json-transaction-repository.ts';
import { JsonTransactionCommandRepository } from './modules/transactions/infrastructure/json-transaction-command-repository.ts';
import { PendingTransactionScheduler } from './modules/transactions/infrastructure/pending-transaction-scheduler.ts';
import {
  CryptoTransactionIdGenerator,
  Sha256StringHasher,
  SystemClock,
} from './modules/transactions/infrastructure/runtime-services.ts';
import { parseDatabaseFileConfig } from './shared/persistence/json/database-file-config.ts';
import type { Logger } from './shared/observability/logger.ts';

export interface RuntimeConfigInput {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly dataDirectory?: string;
  readonly logger: Logger;
}

export const createRuntimeApp = async ({
  argv,
  env,
  dataDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../data',
  ),
  logger,
}: RuntimeConfigInput) => {
  const { databaseFile } = parseDatabaseFileConfig({
    argv,
    env,
    dataDirectory,
  });
  const explicitSeed = argv.includes('--seed-demo');
  const selectedExplicitly =
    argv.some(
      (argument) =>
        argument === '--database-file' ||
        argument.startsWith('--database-file='),
    ) || env.DATABASE_FILE !== undefined;
  const database = createTransactionDatabase(databaseFile, logger);
  await initializeTransactionDatabase(database, {
    seedDemo: explicitSeed || !selectedExplicitly,
  });
  const repository = new JsonTransactionRepository(database);
  const commandRepository = new JsonTransactionCommandRepository(database);
  const clock = new SystemClock();
  const hasher = new Sha256StringHasher();
  const createTransaction = new CreateTransaction(
    commandRepository,
    clock,
    new CryptoTransactionIdGenerator(),
    hasher,
  );
  const reverseTransaction = new ReverseTransaction(
    commandRepository,
    clock,
    hasher,
  );
  const posting = new PostPendingTransactions(commandRepository, clock);
  const scheduler = new PendingTransactionScheduler(
    posting,
    logger.child({ component: 'scheduler' }),
  );
  return {
    app: createApp({
      listTransactions: new ListTransactions(repository),
      getTransaction: new GetTransaction(repository),
      createTransaction,
      reverseTransaction,
      clock,
      logger: logger.child({ component: 'http' }),
    }),
    databaseFile,
    logger,
    scheduler,
  };
};
