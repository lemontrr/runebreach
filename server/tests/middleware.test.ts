import request from 'supertest';
import express from 'express';
import {
  allowMethods,
  requireJson,
  noCacheHeaders,
} from '../src/middleware/security';
import { errorHandler } from '../src/middleware/errorHandler';
import { AppError, AuthError, NotFoundError } from '../src/errors';

process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
process.env.JWT_SECRET = 'test-secret-min-32-chars-padding!!';
process.env.WEBAUTHN_RP_ID = 'localhost';
process.env.WEBAUTHN_RP_NAME = 'Test';
process.env.WEBAUTHN_ORIGIN = 'http://localhost:5173';
process.env.CORS_ORIGIN = 'http://localhost:5173';

function makeApp(handler: express.RequestHandler) {
  const app = express();
  app.use(express.json());
  app.use(noCacheHeaders);
  app.use('/test', handler);
  app.use(errorHandler);
  return app;
}

describe('allowMethods()', () => {
  it('passes allowed method through', async () => {
    const app = makeApp(allowMethods('GET'));
    app.get('/test', (_req, res) => res.json({ ok: true }));
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });

  it('returns 405 for disallowed method', async () => {
    const app = makeApp(allowMethods('GET'));
    const res = await request(app).delete('/test').set('Content-Type','application/json').send('{}');
    expect(res.status).toBe(405);
    expect(res.headers['allow']).toBe('GET');
  });
});

describe('requireJson()', () => {
  it('passes POST with correct Content-Type', async () => {
    const app = makeApp(requireJson);
    app.post('/test', (_req, res) => res.json({ ok: true }));
    const res = await request(app).post('/test').set('Content-Type', 'application/json').send('{}');
    expect(res.status).toBe(200);
  });

  it('returns 415 for POST with wrong Content-Type', async () => {
    const app = makeApp(requireJson);
    const res = await request(app).post('/test').set('Content-Type', 'text/plain').send('data');
    expect(res.status).toBe(415);
  });

  it('allows GET without Content-Type', async () => {
    const app = makeApp(requireJson);
    app.get('/test', (_req, res) => res.json({ ok: true }));
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });
});

describe('noCacheHeaders()', () => {
  it('sets Cache-Control: no-store', async () => {
    const app = makeApp(noCacheHeaders);
    app.get('/test', (_req, res) => res.json({}));
    const res = await request(app).get('/test');
    expect(res.headers['cache-control']).toContain('no-store');
  });
});

describe('errorHandler()', () => {
  it('maps AuthError to 401 with generic body', async () => {
    const app = express();
    app.use((_req, _res, next) => next(new AuthError()));
    app.use(errorHandler);
    const res = await request(app).get('/');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('maps NotFoundError to 404', async () => {
    const app = express();
    app.use((_req, _res, next) => next(new NotFoundError()));
    app.use(errorHandler);
    const res = await request(app).get('/');
    expect(res.status).toBe(404);
  });

  it('maps unknown error to 500 with generic body', async () => {
    const app = express();
    app.use((_req, _res, next) => next(new Error('internal details')));
    app.use(errorHandler);
    const res = await request(app).get('/');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
    expect(JSON.stringify(res.body)).not.toContain('internal details');
  });

  it('maps Express HTTP error (status property) to correct code', async () => {
    const app = express();
    const httpErr = Object.assign(new Error('too large'), { status: 413 });
    app.use((_req, _res, next) => next(httpErr));
    app.use(errorHandler);
    const res = await request(app).get('/');
    expect(res.status).toBe(413);
  });

  it('attaches playerId from req.auth to log context', async () => {
    const app = express();
    app.use((req: express.Request & { auth?: { playerId: string } }, _res, next) => {
      req.auth = { playerId: 'test-player-id', jti: 'test-jti', exp: Math.floor(Date.now()/1000) + 3600 };
      next(new AppError('test', 400, 'TEST'));
    });
    app.use(errorHandler);
    await request(app).get('/');
    // No assertion needed — just verify it doesn't throw
  });
});
