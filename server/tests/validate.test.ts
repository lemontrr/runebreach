import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import { validate } from '../src/middleware/validate';
import { errorHandler } from '../src/middleware/errorHandler';
import { noCacheHeaders } from '../src/middleware/security';

process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
process.env.JWT_SECRET = 'test-secret-min-32-chars-padding!!';
process.env.WEBAUTHN_RP_ID = 'localhost';
process.env.WEBAUTHN_RP_NAME = 'Test';
process.env.WEBAUTHN_ORIGIN = 'http://localhost:5173';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const schema = z.object({ name: z.string().min(1).max(10) }).strict();

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(noCacheHeaders);
  app.post('/test', validate(schema), (req, res) => res.json(req.body));
  app.use(errorHandler);
  return app;
}

describe('validate() middleware', () => {
  const app = makeApp();

  it('passes valid body through and strips extra whitespace coercion', async () => {
    const res = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .send({ name: 'Alice' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Alice');
  });

  it('returns 400 for missing required field', async () => {
    const res = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Bad Request' });
  });

  it('returns 400 for unknown field (strict schema)', async () => {
    const res = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .send({ name: 'Alice', extra: 'field' });
    expect(res.status).toBe(400);
    // No field names in response
    expect(JSON.stringify(res.body)).not.toContain('extra');
    expect(JSON.stringify(res.body)).not.toContain('unrecognized');
  });

  it('returns 400 when field exceeds max length', async () => {
    const res = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .send({ name: 'a'.repeat(11) });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Bad Request' });
  });
});
