/**
 * Route integration tests — mock DB pool, services, and requireAuth middleware
 * to test route logic without a live database or real JWTs.
 */

// ── Environment ────────────────────────────────────────────────────────────
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
process.env.JWT_SECRET = 'test-secret-min-32-chars-padding!!';
process.env.WEBAUTHN_RP_ID = 'localhost';
process.env.WEBAUTHN_RP_NAME = 'Test';
process.env.WEBAUTHN_ORIGIN = 'http://localhost:5173';
process.env.CORS_ORIGIN = 'http://localhost:5173';

// ── Mocks (hoisted — factory cannot reference outer variables) ─────────────
const TEST_PLAYER_ID = 'a0000000-0000-0000-0000-000000000001';

jest.mock('../src/middleware/requireAuth', () => ({
  requireAuth: (
    req: import('express').Request,
    _res: import('express').Response,
    next: import('express').NextFunction,
  ) => {
    // Inject auth context — simulates a valid authenticated request
    (req as typeof req & { auth: unknown }).auth = {
      playerId: 'a0000000-0000-0000-0000-000000000001',
      jti: 'test-jti',
      exp: 9999999999,
    };
    next();
  },
}));

jest.mock('../src/db/client', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('../src/services/webauthn', () => ({
  beginRegistration: jest.fn().mockResolvedValue({ challenge: 'ch', options: {} }),
  finishRegistration: jest.fn().mockResolvedValue({
    verified: true,
    registrationInfo: {
      credential: { id: 'cred-id', publicKey: new Uint8Array(), counter: 0 },
    },
  }),
  beginAuthentication: jest.fn().mockResolvedValue({ challenge: 'ch' }),
  finishAuthentication: jest.fn().mockResolvedValue({
    verified: true,
    authenticationInfo: { newCounter: 1 },
  }),
}));

jest.mock('../src/services/denylist', () => ({
  denylist: {
    isListed: jest.fn().mockResolvedValue(false),
    add: jest.fn().mockResolvedValue(undefined),
    addAllForPlayer: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../src/services/jwtService', () => ({
  issueToken: jest.fn().mockResolvedValue({
    token: 'mock.token.value',
    expiresAt: new Date(Date.now() + 900_000),
  }),
}));

import request from 'supertest';
import { createApp } from '../src/app';
import { pool } from '../src/db/client';

const mockQuery = pool.query as jest.Mock;
const app = createApp();

beforeEach(() => mockQuery.mockReset());

// ── POST /auth/register/begin ──────────────────────────────────────────────
describe('POST /auth/register/begin', () => {
  it('returns 200 with options on valid displayName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: TEST_PLAYER_ID }] });
    const res = await request(app)
      .post('/auth/register/begin')
      .set('Content-Type', 'application/json')
      .send({ displayName: 'Alice' });
    expect(res.status).toBe(200);
    expect(res.body.playerId).toBe(TEST_PLAYER_ID);
  });

  it('returns 400 for missing displayName', async () => {
    const res = await request(app)
      .post('/auth/register/begin')
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Bad Request' });
  });

  it('returns 400 for displayName > 64 chars', async () => {
    const res = await request(app)
      .post('/auth/register/begin')
      .set('Content-Type', 'application/json')
      .send({ displayName: 'x'.repeat(65) });
    expect(res.status).toBe(400);
  });

  it('returns 400 for extra unknown fields (strict schema)', async () => {
    const res = await request(app)
      .post('/auth/register/begin')
      .set('Content-Type', 'application/json')
      .send({ displayName: 'Alice', extra: 'field' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('extra');
  });
});

// ── POST /auth/register/finish ─────────────────────────────────────────────
describe('POST /auth/register/finish', () => {
  it('returns 200 on successful mock verification', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await request(app)
      .post('/auth/register/finish')
      .set('Content-Type', 'application/json')
      .send({ playerId: TEST_PLAYER_ID, response: { id: 'cred', type: 'public-key' } });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('registered');
  });

  it('returns 401 when finishRegistration returns verified:false', async () => {
    const { finishRegistration } = require('../src/services/webauthn');
    (finishRegistration as jest.Mock).mockResolvedValueOnce({ verified: false });
    const res = await request(app)
      .post('/auth/register/finish')
      .set('Content-Type', 'application/json')
      .send({ playerId: TEST_PLAYER_ID, response: {} });
    expect(res.status).toBe(401);
  });
});

// ── POST /auth/authenticate/begin ──────────────────────────────────────────
describe('POST /auth/authenticate/begin', () => {
  it('returns 200 for existing player', async () => {
    mockQuery.mockResolvedValue({ rows: [{ credential_id: 'cred-1' }] });
    const res = await request(app)
      .post('/auth/authenticate/begin')
      .set('Content-Type', 'application/json')
      .send({ playerId: TEST_PLAYER_ID });
    expect(res.status).toBe(200);
  });

  it('returns 200 (not 404) for unknown playerId — enumeration prevention (RISK-001)', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await request(app)
      .post('/auth/authenticate/begin')
      .set('Content-Type', 'application/json')
      .send({ playerId: 'b0000000-0000-0000-0000-000000000002' });
    // Must return 200 even if player does not exist
    expect(res.status).toBe(200);
  });

  it('returns 400 for non-UUID playerId', async () => {
    const res = await request(app)
      .post('/auth/authenticate/begin')
      .set('Content-Type', 'application/json')
      .send({ playerId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });
});

// ── POST /auth/authenticate/finish ─────────────────────────────────────────
describe('POST /auth/authenticate/finish', () => {
  it('returns 401 when finishAuthentication returns verified:false', async () => {
    const { finishAuthentication } = require('../src/services/webauthn');
    (finishAuthentication as jest.Mock).mockResolvedValueOnce({ verified: false });
    mockQuery.mockResolvedValue({
      rows: [{
        id: 'cred-row-id',
        credential_id: 'cred-1',
        public_key: Buffer.alloc(32),
        sign_count: 0,
      }],
    });
    const res = await request(app)
      .post('/auth/authenticate/finish')
      .set('Content-Type', 'application/json')
      .send({ playerId: TEST_PLAYER_ID, response: { id: 'cred-1', type: 'public-key' } });
    expect(res.status).toBe(401);
  });

  it('returns 200 with token on successful authentication', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'cred-row-id',
          credential_id: 'cred-1',
          public_key: Buffer.alloc(32),
          sign_count: 0,
        }],
      })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/auth/authenticate/finish')
      .set('Content-Type', 'application/json')
      .send({ playerId: TEST_PLAYER_ID, response: { id: 'cred-1', type: 'public-key' } });
    expect(res.status).toBe(200);
    expect(res.body.token).toBe('mock.token.value');
  });

  it('returns 401 when credential not found', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await request(app)
      .post('/auth/authenticate/finish')
      .set('Content-Type', 'application/json')
      .send({ playerId: TEST_PLAYER_ID, response: { id: 'no-such-cred', type: 'public-key' } });
    expect(res.status).toBe(401);
  });
});

// ── POST /auth/logout ──────────────────────────────────────────────────────
describe('POST /auth/logout', () => {
  it('returns 204 with mocked auth', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await request(app)
      .post('/auth/logout')
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer mock-token')
      .send({});
    expect(res.status).toBe(204);
  });
});

// ── DELETE /players/:id ────────────────────────────────────────────────────
describe('DELETE /players/:id', () => {
  it('returns 204 when player deletes their own account', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: TEST_PLAYER_ID }] });
    const res = await request(app)
      .delete(`/players/${TEST_PLAYER_ID}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer mock-token')
      .send({});
    expect(res.status).toBe(204);
  });

  it('returns 404 when player row not found in DB', async () => {
    mockQuery.mockResolvedValue({ rows: [] }); // DELETE returns no rows
    const res = await request(app)
      .delete(`/players/${TEST_PLAYER_ID}`)
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer mock-token')
      .send({});
    expect(res.status).toBe(404);
  });

  it('returns 403 when player tries to delete a different account', async () => {
    const res = await request(app)
      .delete('/players/b0000000-0000-0000-0000-000000000002')
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer mock-token')
      .send({});
    expect(res.status).toBe(403);
  });
});

// ── GET /classes ───────────────────────────────────────────────────────────
describe('GET /classes', () => {
  it('returns 200 with class list', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        id: 'class-1', name: 'Mage',
        base_hp: 10, base_attack: 10, base_defense: 10, base_speed: 10,
        ability_id: 'ab-1', ability_name: 'TBD', ability_description: 'Pending',
      }],
    });
    const res = await request(app)
      .get('/classes')
      .set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Mage');
    expect(res.body[0].abilities).toHaveLength(1);
  });

  it('returns 200 with empty abilities when ability_id is null', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        id: 'class-1', name: 'Warrior',
        base_hp: 10, base_attack: 10, base_defense: 10, base_speed: 10,
        ability_id: null, ability_name: null, ability_description: null,
      }],
    });
    const res = await request(app)
      .get('/classes')
      .set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(200);
    expect(res.body[0].abilities).toHaveLength(0);
  });
});
