import type { TransactionDto } from '@card-platform/contracts';

export interface TransactionHistoryOutletContext {
  readonly updateLoadedTransaction: (transaction: TransactionDto) => void;
  readonly reconcileStatusTransition: (
    previous: TransactionDto,
    next: TransactionDto,
  ) => void;
}
