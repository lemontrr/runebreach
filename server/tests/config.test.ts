describe('config required() guard', () => {
  const ORIG = { ...process.env };

  afterEach(() => {
    // Restore env
    Object.assign(process.env, ORIG);
  });

  it('throws when a required env var is missing', () => {
    delete process.env.JWT_SECRET;
    jest.resetModules();
    expect(() => require('../src/config')).toThrow('JWT_SECRET');
  });
});

describe('Logger debug level', () => {
  it('debug() does not throw', async () => {
    jest.resetModules();
    process.env.LOG_LEVEL = 'debug';
    process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
    process.env.JWT_SECRET = 'test-secret-min-32-chars-padding!!';
    process.env.WEBAUTHN_RP_ID = 'localhost';
    process.env.WEBAUTHN_RP_NAME = 'Test';
    process.env.WEBAUTHN_ORIGIN = 'http://localhost:5173';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    const { createLogger } = await import('../src/logger');
    const { Writable } = await import('stream');
    const stream = new Writable({ write(_c, _e, cb) { cb(); } });
    const log = createLogger(stream as never);
    expect(() => log.debug('test debug', { endpoint: '/test' })).not.toThrow();
  });
});
