import request from 'supertest';
import express from 'express';
import { authRateLimit, gameRateLimit, assertRequiredEnvVars } from '../src/middleware/security';
import { errorHandler } from '../src/middleware/errorHandler';

process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
process.env.JWT_SECRET = 'test-secret-min-32-chars-padding!!';
process.env.WEBAUTHN_RP_ID = 'localhost';
process.env.WEBAUTHN_RP_NAME = 'Test';
process.env.WEBAUTHN_ORIGIN = 'http://localhost:5173';
process.env.CORS_ORIGIN = 'http://localhost:5173';

describe('Rate limit middleware handlers', () => {
  it('authRateLimit returns 429 when limit exceeded', async () => {
    const app = express();
    app.use(authRateLimit);
    app.get('/auth', (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    // Exhaust the limit (10 req/min window)
    const results: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await request(app).get('/auth');
      results.push(res.status);
    }
    expect(results).toContain(429);
  });

  it('gameRateLimit returns 429 when limit exceeded', async () => {
    const app = express();
    app.use(gameRateLimit);
    app.get('/game', (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const results: number[] = [];
    for (let i = 0; i < 101; i++) {
      const res = await request(app).get('/game');
      results.push(res.status);
    }
    expect(results).toContain(429);
  });
});

describe('assertRequiredEnvVars()', () => {
  it('does not throw when all required env vars are set', () => {
    expect(() => assertRequiredEnvVars()).not.toThrow();
  });
});
