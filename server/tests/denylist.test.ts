process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
process.env.JWT_SECRET = 'test-secret-min-32-chars-padding!!';
process.env.WEBAUTHN_RP_ID = 'localhost';
process.env.WEBAUTHN_RP_NAME = 'Test';
process.env.WEBAUTHN_ORIGIN = 'http://localhost:5173';
process.env.CORS_ORIGIN = 'http://localhost:5173';

jest.mock('../src/db/client', () => ({
  pool: { query: jest.fn() },
}));

import { pool } from '../src/db/client';
import { denylist } from '../src/services/denylist';

const mockQuery = pool.query as jest.Mock;

beforeEach(() => mockQuery.mockReset());

describe('denylist', () => {
  it('isListed returns true when JTI found in DB', async () => {
    mockQuery.mockResolvedValue({ rows: [{ jti: 'test-jti' }] });
    expect(await denylist.isListed('test-jti')).toBe(true);
  });

  it('isListed returns false when JTI not in DB', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    expect(await denylist.isListed('unknown-jti')).toBe(false);
  });

  it('isListed throws (fail-closed) when DB rejects', async () => {
    mockQuery.mockRejectedValue(new Error('DB down'));
    await expect(denylist.isListed('jti')).rejects.toThrow('DB down');
  });

  it('add inserts JTI into DB', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const exp = new Date(Date.now() + 900_000);
    await denylist.add('jti-123', exp);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO denylisted_token'),
      ['jti-123', exp],
    );
  });

  it('addAllForPlayer resolves without error', async () => {
    await expect(denylist.addAllForPlayer('player-id')).resolves.toBeUndefined();
  });
});
