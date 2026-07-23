import type { TransactionStatus } from '../domain/transaction.ts';
import type {
  ListTransactionsCriteria,
  ListTransactionsResult,
  TransactionRepository,
} from './ports/transaction-repository.ts';

export interface ListTransactionsInput {
  readonly accountId: string;
  readonly status?: TransactionStatus;
  readonly pageSize: number;
  readonly pageToken?: string;
}

export class ListTransactions {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  execute(input: ListTransactionsInput): Promise<ListTransactionsResult> {
    const criteria: ListTransactionsCriteria = {
      accountId: input.accountId,
      pageSize: input.pageSize,
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.pageToken === undefined ? {} : { pageToken: input.pageToken }),
    };

    return this.transactionRepository.listByAccount(criteria);
  }
}
