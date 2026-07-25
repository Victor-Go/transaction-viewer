import type { Clock } from './ports/runtime-services.ts';
import type { TransactionCommandRepository } from './ports/transaction-command-repository.ts';
import {
  PENDING_POST_DELAY_MILLISECONDS,
  isPendingPostingEligible,
  postPendingTransaction,
} from '../domain/transaction-policy.ts';

export class PostPendingTransactions {
  constructor(
    private readonly repository: TransactionCommandRepository,
    private readonly clock: Clock,
  ) {}

  execute(): Promise<{ readonly postedCount: number }> {
    const now = this.clock.now();
    const cutoff = new Date(now.valueOf() - PENDING_POST_DELAY_MILLISECONDS);
    return this.repository.transaction((session) => {
      const eligible = session
        .findPendingCreatedAtOrBefore(cutoff)
        .filter((transaction) => isPendingPostingEligible(transaction, now));
      for (const transaction of eligible) {
        session.replaceTransaction(postPendingTransaction(transaction, now));
      }
      return { postedCount: eligible.length };
    });
  }
}
