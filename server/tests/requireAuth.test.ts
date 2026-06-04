process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
process.env.JWT_SECRET = 'test-secret-min-32-chars-padding!!';
process.env.WEBAUTHN_RP_ID = 'localhost';
process.env.WEBAUTHN_RP_NAME = 'Test';
process.env.WEBAUTHN_ORIGIN = 'http://localhost:5173';
process.env.CORS_ORIGIN = 'http://localhost:5173';

jest.mock('../src/services/denylist', () => ({
  denylist: {
    isListed: jest.fn().mockResolvedValue(false),
    add: jest.fn(),
    addAllForPlayer: jest.fn(),
  },
}));

import { SignJWT } from 'jose';
import express from 'express';
import request from 'supertest';
import { requireAuth } from '../src/middleware/requireAuth';
import { denylist } from '../src/services/denylist';

const SECRET = process.env.JWT_SECRET!;
const PLAYER_ID = 'a0000000-0000-0000-0000-000000000001';

async function makeJwt(overrides: Partial<{
  alg: string;
  iss: string;
  aud: string;
  exp: string | number;
  sub: string;
  jti: string;
}> = {}): Promise<string> {
  const key = new TextEncoder().encode(SECRET);
  const alg = (overrides.alg as 'HS256') ?? 'HS256';
  const jwt = new SignJWT({
    sub: overrides.sub ?? PLAYER_ID,
    jti: overrides.jti ?? 'test-jti',
  })
    .setProtectedHeader({ alg })
    .setIssuer(overrides.iss ?? 'runebreach-api')
    .setAudience(overrides.aud ?? 'runebreach-api')
    .setIssuedAt();

  if (overrides.exp !== undefined) {
    jwt.setExpirationTime(overrides.exp);
  } else {
    jwt.setExpirationTime('1h');
  }
  jwt.setNotBefore(Math.floor(Date.now() / 1000));

  return jwt.sign(key);
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.get('/protected', requireAuth, (req, res) => {
    res.json({ playerId: req.auth?.playerId });
  });
  return app;
}

describe('requireAuth middleware', () => {
  const app = makeApp();
  const mockIsListed = denylist.isListed as jest.Mock;

  beforeEach(() => mockIsListed.mockResolvedValue(false));

  it('returns 401 when no Authorization header', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  it('returns 401 for non-Bearer scheme', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Basic abc');
    expect(res.status).toBe(401);
  });

  it('returns 200 and sets req.auth for a valid token', async () => {
    const token = await makeJwt();
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.playerId).toBe(PLAYER_ID);
  });

  it('returns 401 for an expired token', async () => {
    const token = await makeJwt({ exp: '-1s' });
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for wrong issuer', async () => {
    const token = await makeJwt({ iss: 'wrong-issuer' });
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for wrong audience', async () => {
    const token = await makeJwt({ aud: 'wrong-audience' });
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 when token JTI is on the denylist', async () => {
    mockIsListed.mockResolvedValue(true);
    const token = await makeJwt();
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 (fail-closed) when denylist throws', async () => {
    mockIsListed.mockRejectedValue(new Error('DB down'));
    const token = await makeJwt();
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for a completely invalid token string', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
  });

  it('returns 401 for token missing sub claim', async () => {
    // Craft a token without sub by signing raw payload
    const key = new TextEncoder().encode(SECRET);
    const { SignJWT: RawSign } = await import('jose');
    const token = await new RawSign({ jti: 'jti-only' })  // no sub
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('runebreach-api')
      .setAudience('runebreach-api')
      .setExpirationTime('1h')
      .setNotBefore(Math.floor(Date.now() / 1000))
      .setIssuedAt()
      .sign(key);
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
