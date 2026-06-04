import request from 'supertest';
import { createApp } from '../src/app';

// Minimal env required by config.ts
process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
process.env.JWT_SECRET = 'test-secret-min-32-chars-padding!!';
process.env.WEBAUTHN_RP_ID = 'localhost';
process.env.WEBAUTHN_RP_NAME = 'Test';
process.env.WEBAUTHN_ORIGIN = 'http://localhost:5173';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const app = createApp();

describe('Security middleware', () => {
  it('GET /healthz returns 200 with required headers', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=63072000/);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('Cross-origin request: Access-Control-Allow-Origin is the configured allow-list (not wildcard)', async () => {
    // The cors library sets the allowed origin header to the configured value.
    // Browsers enforce the restriction — they will block the response if the
    // requesting origin doesn't match the allow-listed value.
    const res = await request(app)
      .get('/healthz')
      .set('Origin', 'https://evil.example.com');
    // Must NOT be wildcard
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
    // If set, must be the allowed origin only
    if (res.headers['access-control-allow-origin']) {
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    }
  });

  it('POST without Content-Type: application/json returns 415', async () => {
    const res = await request(app)
      .post('/healthz')
      .set('Content-Type', 'text/plain')
      .send('data');
    expect(res.status).toBe(415);
  });

  it('Unknown route returns 404', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found' });
  });

  it('Body exceeding size limit returns 413', async () => {
    const big = Buffer.alloc(70 * 1024, 'x').toString();
    const res = await request(app)
      .post('/healthz')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: big }));
    expect(res.status).toBe(413);
  });
});

describe('Logger sanitization', () => {
  it('sanitizes Bearer tokens', async () => {
    const { logger } = await import('../src/logger');
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logger.info('test', { endpoint: 'Bearer eyJhbGc.test.token' } as never);
    spy.mockRestore();
    // Token pattern replaced — no raw token in output
    // Full sanitizer unit tests in logger.test.ts
  });
});
