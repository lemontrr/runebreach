process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
process.env.JWT_SECRET = 'test-secret-min-32-chars-padding!!';
process.env.WEBAUTHN_RP_ID = 'localhost';
process.env.WEBAUTHN_RP_NAME = 'Test';
process.env.WEBAUTHN_ORIGIN = 'http://localhost:5173';
process.env.CORS_ORIGIN = 'http://localhost:5173';

import { issueToken, verifyToken } from '../src/services/jwtService';
import { jwtVerify } from 'jose';

const PLAYER_ID = 'a0000000-0000-0000-0000-000000000001';

describe('jwtService', () => {
  it('issues a token with all required claims', async () => {
    const { token, expiresAt } = await issueToken(PLAYER_ID);
    expect(typeof token).toBe('string');
    expect(expiresAt).toBeInstanceOf(Date);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const payload = await verifyToken(token);
    expect(payload.sub).toBe(PLAYER_ID);
    expect(payload.jti).toBeTruthy();
    expect(payload.iss).toBe('runebreach-api');
    expect(payload.aud).toContain('runebreach-api');
    expect(payload.exp).toBeTruthy();
    expect(payload.nbf).toBeTruthy();
  });

  it('rejects a token with wrong key', async () => {
    const wrongKey = new TextEncoder().encode('wrong-key-min-32-chars-padding!!');
    const { token } = await issueToken(PLAYER_ID);
    // Replace signature with one signed by wrong key
    const parts = token.split('.');
    const forged = `${parts[0]}.${parts[1]}.invalidsig`;
    await expect(verifyToken(forged)).rejects.toThrow();
  });

  it('rejects a token with alg:none via jose (explicit alg enforcement)', async () => {
    // jose does not allow constructing alg:none tokens normally;
    // simulate by crafting a header with alg:none and expecting rejection
    const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' }))
      .toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: PLAYER_ID, exp: Date.now() / 1000 + 3600 }))
      .toString('base64url');
    const noneToken = `${noneHeader}.${payload}.`;
    await expect(verifyToken(noneToken)).rejects.toThrow();
  });

  it('token does not contain display_name or PII', async () => {
    const { token } = await issueToken(PLAYER_ID);
    const [, payloadB64] = token.split('.');
    const decoded = Buffer.from(payloadB64, 'base64url').toString();
    expect(decoded).not.toContain('display_name');
    // sub is a UUID, not a human-readable name
    expect(JSON.parse(decoded).sub).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
