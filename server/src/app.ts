import express from 'express';
import {
  helmetMiddleware,
  corsMiddleware,
  noCacheHeaders,
  requireJson,
} from './middleware/security.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { playersRouter } from './routes/players.js';
import { classesRouter } from './routes/classes.js';

export function createApp(): express.Application {
  const app = express();

  // Trust proxy for rate-limiter IP detection behind Azure App Service
  app.set('trust proxy', 1);

  // Security headers first
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(noCacheHeaders);

  // Body parsing — size limit enforced (413 on breach)
  app.use(express.json({ limit: '64kb' }));
  app.use(requireJson);

  // Health check — no auth, no rate limit
  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/auth', authRouter);
  app.use('/players', playersRouter);
  app.use('/classes', classesRouter);
  // /sessions router registered in Wave 4

  // 404 for unmatched routes
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // Global error handler — must be last
  app.use(errorHandler);

  return app;
}
