import cron from 'node-cron';

import type { Logger } from '../../../shared/observability/logger.ts';

const PENDING_RECONCILIATION_CRON = '*/5 * * * * *';

interface PostingExecutor {
  execute(): Promise<{ readonly postedCount: number }>;
}

interface CronTask {
  start(): void;
  stop(): void;
}

type CronTaskFactory = (
  expression: string,
  handler: () => Promise<void> | void,
) => CronTask;

const createCronTask: CronTaskFactory = (expression, handler) => {
  const task = cron.createTask(expression, handler);
  return {
    start: () => {
      void task.start();
    },
    stop: () => {
      void task.stop();
    },
  };
};

export interface PendingScheduler {
  reconcile(): Promise<void>;
  start(): void;
  stop(): void;
}

export class PendingTransactionScheduler implements PendingScheduler {
  readonly #task: CronTask;
  #started = false;
  #reconciling = false;

  constructor(
    private readonly posting: PostingExecutor,
    private readonly logger: Logger,
    createTask: CronTaskFactory = createCronTask,
  ) {
    this.#task = createTask(PENDING_RECONCILIATION_CRON, () =>
      this.reconcile(),
    );
  }

  async reconcile(): Promise<void> {
    if (this.#reconciling) return;
    this.#reconciling = true;
    try {
      const result = await this.posting.execute();
      if (result.postedCount > 0) {
        this.logger.info(
          {
            component: 'pending-transaction-scheduler',
            event: 'transactions_posted',
            postedCount: result.postedCount,
          },
          'Pending transactions posted',
        );
      }
    } catch (error) {
      this.logger.error(
        {
          component: 'pending-transaction-scheduler',
          event: 'scheduler_failed',
          err: {
            type:
              error instanceof Error ? error.constructor.name : 'UnknownError',
          },
        },
        'Pending transaction reconciliation failed',
      );
    } finally {
      this.#reconciling = false;
    }
  }

  start(): void {
    if (this.#started) return;
    this.#started = true;
    this.#task.start();
    this.logger.info(
      {
        component: 'pending-transaction-scheduler',
        event: 'scheduler_started',
      },
      'Pending transaction scheduler started',
    );
  }

  stop(): void {
    if (!this.#started) return;
    this.#started = false;
    this.#task.stop();
    this.logger.info(
      {
        component: 'pending-transaction-scheduler',
        event: 'scheduler_stopped',
      },
      'Pending transaction scheduler stopped',
    );
  }
}
