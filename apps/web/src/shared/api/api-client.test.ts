import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../test/server';
import {
  ApiError,
  NetworkError,
  RequestAbortedError,
  ResponseContractError,
  isUncertainWriteError,
  requestJson,
} from './api-client';

const valueSchema = {
  safeParse: (value: unknown) =>
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    typeof value.value === 'string'
      ? { success: true as const, data: value as { value: string } }
      : { success: false as const },
};

describe('requestJson', () => {
  it('returns validated JSON, status, and headers for a successful GET', async () => {
    server.use(
      http.get('/test/success', () =>
        HttpResponse.json(
          { value: 'ok' },
          { status: 200, headers: { Location: '/resource/one' } },
        ),
      ),
    );

    const result = await requestJson({
      method: 'GET',
      path: '/test/success',
      schema: valueSchema,
    });

    expect(result.data).toEqual({ value: 'ok' });
    expect(result.status).toBe(200);
    expect(result.headers.get('Location')).toBe('/resource/one');
  });

  it('parses a safe public API error', async () => {
    server.use(
      http.get('/test/error', () =>
        HttpResponse.json(
          {
            error: {
              code: 'TRANSACTION_NOT_FOUND',
              message: 'The transaction was not found.',
            },
          },
          { status: 404 },
        ),
      ),
    );

    const error = await requestJson({
      method: 'GET',
      path: '/test/error',
      schema: valueSchema,
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      code: 'TRANSACTION_NOT_FOUND',
      message: 'The transaction was not found.',
    });
  });

  it.each([
    ['invalid success', '/test/invalid-success', 200, { unexpected: true }],
    ['malformed error', '/test/malformed-error', 500, { secret: 'detail' }],
    ['empty success', '/test/empty', 204, null],
  ])(
    'rejects a %s payload as a contract error',
    async (_name, path, status, body) => {
      server.use(
        http.get(path, () =>
          body === null
            ? new HttpResponse(null, { status })
            : HttpResponse.json(body, { status }),
        ),
      );

      await expect(
        requestJson({ method: 'GET', path, schema: valueSchema }),
      ).rejects.toBeInstanceOf(ResponseContractError);
    },
  );

  it('normalizes a network rejection without logging request data', async () => {
    server.use(http.get('/test/network', () => HttpResponse.error()));

    await expect(
      requestJson({
        method: 'GET',
        path: '/test/network',
        schema: valueSchema,
      }),
    ).rejects.toBeInstanceOf(NetworkError);
  });

  it('normalizes an aborted request distinctly', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      requestJson({
        method: 'GET',
        path: '/test/abort',
        schema: valueSchema,
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(RequestAbortedError);
  });
});

describe('isUncertainWriteError', () => {
  it('treats a malformed successful response as an uncertain write result', () => {
    expect(isUncertainWriteError(new ResponseContractError())).toBe(true);
  });
});
