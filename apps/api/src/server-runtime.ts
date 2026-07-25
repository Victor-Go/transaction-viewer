import type { Logger } from './shared/observability/logger.ts';

interface ListeningServer {
  on(event: 'error', listener: (error: unknown) => void): unknown;
  close?(listener: (error?: Error) => void): void;
}

interface ListenApplication {
  listen(port: number, listener: () => void): ListeningServer;
}

interface ProcessState {
  exitCode: number | string | null | undefined;
}

interface SignalSource {
  once(event: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
}

interface RuntimeScheduler {
  reconcile(): Promise<void>;
  start(): void;
  stop(): void;
}

export interface StartApiServerOptions {
  readonly logger: Logger;
  readonly port: number;
  readonly processState: ProcessState;
  readonly signalSource?: SignalSource;
  readonly createRuntime: () => Promise<{
    readonly app: ListenApplication;
    readonly scheduler: RuntimeScheduler;
  }>;
}

const errorType = (error: unknown): string =>
  error instanceof Error ? error.constructor.name : 'UnknownError';

export const startApiServer = async ({
  logger,
  port,
  processState,
  signalSource,
  createRuntime,
}: StartApiServerOptions): Promise<void> => {
  let runtime: Awaited<ReturnType<typeof createRuntime>>;
  try {
    runtime = await createRuntime();
  } catch (error) {
    logger.error(
      {
        component: 'server',
        phase: 'bootstrap',
        err: { type: errorType(error) },
      },
      'API bootstrap failed',
    );
    processState.exitCode = 1;
    return;
  }

  await runtime.scheduler.reconcile();
  runtime.scheduler.start();

  try {
    const server = runtime.app.listen(port, () => {
      logger.info(
        { component: 'server', phase: 'listener', port },
        'API listening',
      );
    });
    server.on('error', (error) => {
      runtime.scheduler.stop();
      logger.error(
        {
          component: 'server',
          phase: 'listener',
          port,
          err: { type: errorType(error) },
        },
        'API listener failed',
      );
      processState.exitCode = 1;
    });
    if (signalSource !== undefined) {
      let shuttingDown = false;
      const shutdown = () => {
        if (shuttingDown) return;
        shuttingDown = true;
        runtime.scheduler.stop();
        logger.info(
          { component: 'server', phase: 'shutdown' },
          'API shutting down',
        );
        server.close?.((error) => {
          if (error !== undefined) {
            logger.error(
              {
                component: 'server',
                phase: 'shutdown',
                err: { type: errorType(error) },
              },
              'API shutdown failed',
            );
            processState.exitCode = 1;
          }
        });
      };
      signalSource.once('SIGINT', shutdown);
      signalSource.once('SIGTERM', shutdown);
    }
  } catch (error) {
    runtime.scheduler.stop();
    logger.error(
      {
        component: 'server',
        phase: 'listener',
        port,
        err: { type: errorType(error) },
      },
      'API listener failed',
    );
    processState.exitCode = 1;
  }
};
