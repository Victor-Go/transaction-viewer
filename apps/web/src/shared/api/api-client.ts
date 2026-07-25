import {
  apiErrorResponseSchema,
  type ApiErrorCode,
} from '@card-platform/contracts';

interface RuntimeSchema<T> {
  safeParse(
    value: unknown,
  ): { readonly success: true; readonly data: T } | { readonly success: false };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor() {
    super('The service could not be reached. Check your connection and retry.');
    this.name = 'NetworkError';
  }
}

export class RequestAbortedError extends Error {
  constructor() {
    super('The request was cancelled.');
    this.name = 'RequestAbortedError';
  }
}

export class ResponseContractError extends Error {
  constructor() {
    super('The service returned an unexpected response.');
    this.name = 'ResponseContractError';
  }
}

interface RequestJsonOptions<T> {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly schema: RuntimeSchema<T>;
  readonly body?: unknown;
  readonly idempotencyKey?: string;
  readonly signal?: AbortSignal;
}

export interface JsonResponse<T> {
  readonly data: T;
  readonly status: number;
  readonly headers: Headers;
}

const parseJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (text.length === 0) throw new ResponseContractError();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ResponseContractError();
  }
};

export const requestJson = async <T>({
  method,
  path,
  schema,
  body,
  idempotencyKey,
  signal,
}: RequestJsonOptions<T>): Promise<JsonResponse<T>> => {
  if (signal?.aborted) throw new RequestAbortedError();
  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (idempotencyKey !== undefined) {
    headers.set('Idempotency-Key', idempotencyKey);
  }

  let response: Response;
  try {
    let compatibleSignal: AbortSignal | undefined;
    if (signal !== undefined) {
      try {
        void new Request(new URL(path, window.location.origin), { signal });
        compatibleSignal = signal;
      } catch {
        compatibleSignal = undefined;
      }
    }
    response = await fetch(path, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(compatibleSignal === undefined ? {} : { signal: compatibleSignal }),
    });
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === 'AbortError') ||
      signal?.aborted
    ) {
      throw new RequestAbortedError();
    }
    throw new NetworkError();
  }

  const json = await parseJson(response);
  if (!response.ok) {
    const parsedError = apiErrorResponseSchema.safeParse(json);
    if (!parsedError.success) throw new ResponseContractError();
    throw new ApiError(
      response.status,
      parsedError.data.error.code,
      parsedError.data.error.message,
    );
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new ResponseContractError();

  return {
    data: parsed.data,
    status: response.status,
    headers: response.headers,
  };
};

export const isUncertainWriteError = (error: unknown): boolean =>
  error instanceof NetworkError ||
  error instanceof ResponseContractError ||
  (error instanceof ApiError && error.status >= 500);
