process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
process.env.JWT_SECRET = 'test-secret-min-32-chars-padding!!';
process.env.WEBAUTHN_RP_ID = 'localhost';
process.env.WEBAUTHN_RP_NAME = 'Test';
process.env.WEBAUTHN_ORIGIN = 'http://localhost:5173';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.MAZE_WIDTH = '10';
process.env.MAZE_HEIGHT = '10';
process.env.ITEM_COUNT = '4';
process.env.MONSTER_COUNT = '2';

jest.mock('../src/middleware/requireAuth', () => ({
  requireAuth: (req: import('express').Request, _: import('express').Response, next: import('express').NextFunction) => {
    (req as typeof req & { auth: unknown }).auth = {
      playerId: 'a0000000-0000-0000-0000-000000000001',
      jti: 'test-jti', exp: 9999999999,
    };
    next();
  },
}));

const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockClientQuery = jest.fn();
const mockRelease = jest.fn();

jest.mock('../src/db/client', () => ({
  pool: {
    query: mockQuery,
    connect: mockConnect,
  },
}));

import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();
const PLAYER_ID = 'a0000000-0000-0000-0000-000000000001';
const CLASS_ID = 'b0000000-0000-0000-0000-000000000001';
const SESSION_ID = 'c0000000-0000-0000-0000-000000000001';

function setupDbClient(hasItems = false, hasMonsters = false) {
  const chain = mockClientQuery
    .mockResolvedValueOnce(undefined)                        // BEGIN
    .mockResolvedValueOnce({ rows: [{ id: SESSION_ID }] }); // INSERT session
  if (hasItems) chain.mockResolvedValueOnce({ rows: [] });   // INSERT items
  if (hasMonsters) chain.mockResolvedValueOnce({ rows: [] });// INSERT monsters
  chain.mockResolvedValueOnce(undefined);                    // COMMIT
  mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockRelease });
}

beforeEach(() => {
  mockQuery.mockReset();
  mockConnect.mockReset();
  mockClientQuery.mockReset();
  mockRelease.mockReset();
});

// ── POST /sessions ────────────────────────────────────────────────────────
describe('POST /sessions', () => {
  it('returns 201 with session data on success', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: CLASS_ID }] })    // classId exists
      .mockResolvedValueOnce({ rows: [                         // item types
        { id: 'it-1', name: 'Sword', category: 'weapon', stat_effect: {} },
        { id: 'it-2', name: 'Armor', category: 'armor', stat_effect: {} },
        { id: 'it-3', name: 'Potion', category: 'potion', stat_effect: {} },
        { id: 'it-4', name: 'Coin', category: 'treasure', stat_effect: {} },
      ]})
      .mockResolvedValueOnce({ rows: [                         // monster types
        { id: 'mt-1', name: 'Goblin', hp: 10, attack: 3, defense: 1, speed: 5, behavior_flags: {} },
      ]});
    setupDbClient(true, true);

    const res = await request(app)
      .post('/sessions')
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer mock')
      .send({ classId: CLASS_ID });

    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBe(SESSION_ID);
    expect(res.body).not.toHaveProperty('mazeSeed');
    expect(res.body.mazeLayout).toBeTruthy();
    expect(Array.isArray(res.body.itemPlacements)).toBe(true);
    expect(Array.isArray(res.body.monsterPlacements)).toBe(true);
  });

  it('returns 400 for missing classId', async () => {
    const res = await request(app)
      .post('/sessions')
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer mock')
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-UUID classId', async () => {
    const res = await request(app)
      .post('/sessions')
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer mock')
      .send({ classId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when classId not in catalog', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // classId not found
    const res = await request(app)
      .post('/sessions')
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer mock')
      .send({ classId: CLASS_ID });
    expect(res.status).toBe(404);
  });

  it('returns 409 when duplicate active session (DB constraint 23505)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: CLASS_ID }] })
      .mockResolvedValueOnce({ rows: [] })   // item types — empty is fine
      .mockResolvedValueOnce({ rows: [] });  // monster types — empty is fine
    const pgConflictErr = Object.assign(new Error('unique violation'), { code: '23505' });
    mockClientQuery
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(pgConflictErr);
    mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockRelease });

    const res = await request(app)
      .post('/sessions')
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer mock')
      .send({ classId: CLASS_ID });
    expect(res.status).toBe(409);
  });

  it('does NOT include maze_seed in the response', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: CLASS_ID }] })
      .mockResolvedValueOnce({ rows: [] })   // item types
      .mockResolvedValueOnce({ rows: [] });  // monster types
    setupDbClient();

    const res = await request(app)
      .post('/sessions')
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer mock')
      .send({ classId: CLASS_ID });

    expect(res.status).toBe(201);
    const responseStr = JSON.stringify(res.body);
    expect(responseStr).not.toContain('mazeSeed');
    expect(responseStr).not.toContain('maze_seed');
  });
});

// ── GET /sessions/:id ─────────────────────────────────────────────────────
describe('GET /sessions/:id', () => {
  it('returns 200 with session state', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: SESSION_ID, player_id: PLAYER_ID, player_class_id: CLASS_ID, maze_layout: '{}', state: 'active' }] })
      .mockResolvedValueOnce({ rows: [{ id: CLASS_ID, name: 'Mage', base_hp: 10, base_attack: 10, base_defense: 10, base_speed: 10 }] })
      .mockResolvedValueOnce({ rows: [] })  // items
      .mockResolvedValueOnce({ rows: [] }); // monsters

    const res = await request(app)
      .get(`/sessions/${SESSION_ID}`)
      .set('Authorization', 'Bearer mock');

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe(SESSION_ID);
    expect(res.body).not.toHaveProperty('mazeSeed');
    expect(res.body).not.toHaveProperty('maze_seed');
  });

  it('returns 404 when session not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get(`/sessions/${SESSION_ID}`)
      .set('Authorization', 'Bearer mock');
    expect(res.status).toBe(404);
  });

  it('returns 403 for cross-player access', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{
      id: SESSION_ID,
      player_id: 'different-player-id',
      player_class_id: CLASS_ID,
      maze_layout: '{}',
      state: 'active',
    }]});

    const res = await request(app)
      .get(`/sessions/${SESSION_ID}`)
      .set('Authorization', 'Bearer mock');
    expect(res.status).toBe(403);
  });
});
