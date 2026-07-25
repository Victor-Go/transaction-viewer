import { createRuntimeApp } from './bootstrap.ts';
import { startApiServer } from './server-runtime.ts';
import { createPinoLogger } from './shared/observability/pino-logger.ts';

const port = Number(process.env.PORT ?? 3000);
const logger = createPinoLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV === undefined
    ? {}
    : { environment: process.env.NODE_ENV }),
});
await startApiServer({
  logger,
  port,
  processState: process,
  signalSource: process,
  createRuntime: async () =>
    createRuntimeApp({
      argv: process.argv.slice(2),
      env: process.env,
      logger,
    }),
});
