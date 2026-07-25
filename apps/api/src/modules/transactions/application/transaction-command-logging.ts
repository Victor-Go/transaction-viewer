import {
  IdempotencyConflictError,
  TransactionNotFoundError,
} from './errors/transaction-command.error.ts';
import {
  ReversalWindowExpiredError,
  TransactionAlreadyReversedError,
  TransactionNotPostedError,
} from '../domain/transaction-policy.ts';
import type { Logger } from '../../../shared/observability/logger.ts';

export type TransactionCommandName =
  'create-transaction' | 'reverse-transaction';

interface CommandExecutor<Input, Result> {
  execute(input: Input): Promise<Result>;
}

const rejectionEvent = (
  error: unknown,
):
  | 'transaction_not_found'
  | 'transaction_not_posted'
  | 'transaction_already_reversed'
  | 'reversal_window_expired'
  | 'idempotency_conflict'
  | null => {
  if (error instanceof TransactionNotFoundError) {
    return 'transaction_not_found';
  }
  if (error instanceof TransactionNotPostedError) {
    return 'transaction_not_posted';
  }
  if (error instanceof TransactionAlreadyReversedError) {
    return 'transaction_already_reversed';
  }
  if (error instanceof ReversalWindowExpiredError) {
    return 'reversal_window_expired';
  }
  if (error instanceof IdempotencyConflictError) {
    return 'idempotency_conflict';
  }
  return null;
};

export class LoggedTransactionCommand<Input, Result> implements CommandExecutor<
  Input,
  Result
> {
  constructor(
    private readonly command: CommandExecutor<Input, Result>,
    private readonly commandName: TransactionCommandName,
    private readonly logger: Logger,
  ) {}

  async execute(input: Input): Promise<Result> {
    try {
      return await this.command.execute(input);
    } catch (error) {
      const event = rejectionEvent(error);
      if (event !== null) {
        this.logger.info(
          {
            component: 'transaction-command',
            event,
            command: this.commandName,
            rejectionReason: event,
          },
          'Transaction command rejected',
        );
      }
      throw error;
    }
  }
}
