import {
  createTransactionResponseSchema,
  getTransactionResponseSchema,
  listTransactionsResponseSchema,
  reverseTransactionResponseSchema,
  type CreateTransactionRequest,
  type CreateTransactionResponse,
  type GetTransactionResponse,
  type ListTransactionsResponse,
  type ReverseTransactionResponse,
  type TransactionStatus,
} from '@card-platform/contracts';

import { requestJson } from '../../../shared/api/api-client';

export interface ListTransactionsOptions {
  readonly status?: TransactionStatus;
  readonly pageSize: number;
  readonly pageToken?: string;
  readonly from?: string;
  readonly to?: string;
  readonly signal?: AbortSignal;
}

const transactionCollectionPath = (accountId: string): string =>
  `/api/v1/accounts/${encodeURIComponent(accountId)}/transactions`;

const transactionPath = (accountId: string, transactionId: string): string =>
  `${transactionCollectionPath(accountId)}/${encodeURIComponent(transactionId)}`;

export const listTransactions = async (
  accountId: string,
  options: ListTransactionsOptions,
): Promise<ListTransactionsResponse> => {
  const search = new URLSearchParams({ pageSize: String(options.pageSize) });
  if (options.status !== undefined) search.set('status', options.status);
  if (options.pageToken !== undefined) {
    search.set('pageToken', options.pageToken);
  }
  if (options.from !== undefined) search.set('from', options.from);
  if (options.to !== undefined) search.set('to', options.to);
  const response = await requestJson({
    method: 'GET',
    path: `${transactionCollectionPath(accountId)}?${search.toString()}`,
    schema: listTransactionsResponseSchema,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  return response.data;
};

export const getTransaction = async (
  accountId: string,
  transactionId: string,
  signal?: AbortSignal,
): Promise<GetTransactionResponse> => {
  const response = await requestJson({
    method: 'GET',
    path: transactionPath(accountId, transactionId),
    schema: getTransactionResponseSchema,
    ...(signal === undefined ? {} : { signal }),
  });
  return response.data;
};

export const createTransaction = async (
  accountId: string,
  body: CreateTransactionRequest,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<CreateTransactionResponse> => {
  const response = await requestJson({
    method: 'POST',
    path: transactionCollectionPath(accountId),
    schema: createTransactionResponseSchema,
    body,
    idempotencyKey,
    ...(signal === undefined ? {} : { signal }),
  });
  return response.data;
};

export const reverseTransaction = async (
  accountId: string,
  transactionId: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<ReverseTransactionResponse> => {
  const response = await requestJson({
    method: 'POST',
    path: `${transactionPath(accountId, transactionId)}/reversal`,
    schema: reverseTransactionResponseSchema,
    body: {},
    idempotencyKey,
    ...(signal === undefined ? {} : { signal }),
  });
  return response.data;
};
