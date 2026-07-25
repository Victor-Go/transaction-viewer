import type { TransactionDto } from '@card-platform/contracts';

export interface CreateTransactionOverlayRequest {
  readonly type: 'create-transaction';
  readonly accountId: string;
  readonly onCreated: (transaction: TransactionDto) => void;
}

export interface ConfirmTransactionReversalOverlayRequest {
  readonly type: 'confirm-transaction-reversal';
  readonly accountId: string;
  readonly transaction: TransactionDto;
  readonly onResolved: (transaction: TransactionDto) => void;
  readonly onNotFound: () => void;
}

export interface DateRangeStrings {
  readonly start: string;
  readonly end: string;
}

export interface TransactionDateSearchOverlayRequest {
  readonly type: 'transaction-date-search';
  readonly appliedValue: DateRangeStrings | null;
  readonly initialVisibleMonth: string;
  readonly minDate: string;
  readonly maxDate: string;
  readonly locale: string;
  readonly onSearch: (range: DateRangeStrings) => void;
}

export type ProgrammaticOverlayRequest =
  | CreateTransactionOverlayRequest
  | ConfirmTransactionReversalOverlayRequest
  | TransactionDateSearchOverlayRequest;

export type OverlayLifecycle = 'open' | 'closing';

export interface OverlayEntry {
  readonly id: string;
  readonly request: ProgrammaticOverlayRequest;
  readonly ownerId?: string;
  readonly lifecycle: OverlayLifecycle;
}

export interface OverlayHandle {
  readonly id: string;
}

export interface OverlayLayer {
  readonly depth: number;
  readonly isTopmost: boolean;
}

export interface OpenOverlayOptions {
  readonly ownerId?: string;
}
