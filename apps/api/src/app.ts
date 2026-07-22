import express from 'express';
import { healthResponseSchema } from '@card-platform/contracts';

export const createApp = (): express.Express => {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.json(healthResponseSchema.parse({ status: 'ok' }));
  });

  return app;
};

export const app = createApp();
