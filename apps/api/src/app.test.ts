import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { app } from './app.js';

describe('API application', () => {
  it('reports its health without starting a listener', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
