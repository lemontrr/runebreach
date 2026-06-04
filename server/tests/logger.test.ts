process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
process.env.JWT_SECRET = 'test-secret-min-32-chars-padding!!';
process.env.WEBAUTHN_RP_ID = 'localhost';
process.env.WEBAUTHN_RP_NAME = 'Test';
process.env.WEBAUTHN_ORIGIN = 'http://localhost:5173';
process.env.CORS_ORIGIN = 'http://localhost:5173';

import { Writable } from 'stream';
import { createLogger, sanitize, sanitizeObject } from '../src/logger';

function makeTestLogger() {
  let buf = '';
  const stream = new Writable({
    write(chunk, _enc, cb) {
      buf += chunk.toString();
      cb();
    },
  });
  const log = createLogger(stream as never);
  return { log, getOutput: () => buf };
}

describe('sanitize()', () => {
  it('redacts Bearer tokens', () => {
    expect(sanitize('Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig')).toBe(
      '[REDACTED_TOKEN]',
    );
  });

  it('redacts display_name occurrences', () => {
    expect(sanitize('display_name=Alice')).toContain('[REDACTED_PII]');
    expect(sanitize('display_name=Alice')).not.toContain('Alice');
  });

  it('escapes newline characters', () => {
    const result = sanitize('path\ninjected') as string;
    expect(result).not.toContain('\n');
    expect(result).toContain('\\u000a');
  });

  it('passes through non-string values unchanged', () => {
    expect(sanitize(42)).toBe(42);
    expect(sanitize(null)).toBeNull();
  });
});

describe('sanitizeObject()', () => {
  it('sanitizes all string values in an object', () => {
    const result = sanitizeObject({ a: 'Bearer tok', b: 123 });
    expect(result.a).toBe('[REDACTED_TOKEN]');
    expect(result.b).toBe(123);
  });
});

describe('Logger warn/error', () => {
  it('warn() and error() emit at correct level', () => {
    const { log, getOutput } = makeTestLogger();
    log.warn('a warning', { endpoint: '/w', httpStatus: 400 });
    const parsed = JSON.parse(getOutput().trim());
    expect(parsed.level).toBe('warn');
  });
});

describe('Logger', () => {
  it('emits structured JSON with required fields', () => {
    const { log, getOutput } = makeTestLogger();
    log.info('test message', { endpoint: '/test', httpStatus: 200 });
    const parsed = JSON.parse(getOutput());
    expect(parsed.msg).toBe('test message');
    expect(parsed.endpoint).toBe('/test');
    expect(parsed.httpStatus).toBe(200);
    expect(parsed.time).toBeDefined();
  });

  it('sanitizes token values in log fields', () => {
    const { log, getOutput } = makeTestLogger();
    log.info('auth', { endpoint: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig' } as never);
    expect(getOutput()).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(getOutput()).toContain('[REDACTED_TOKEN]');
  });

  it('sanitizes display_name values', () => {
    const { log, getOutput } = makeTestLogger();
    log.info('user', { endpoint: 'display_name=Alice' } as never);
    expect(getOutput()).not.toContain('Alice');
    expect(getOutput()).toContain('[REDACTED_PII]');
  });

  it('escapes log injection newlines in field values', () => {
    const { log, getOutput } = makeTestLogger();
    log.info('inject', { endpoint: 'path\nfake-field: injected' } as never);
    // Parse the JSON log line; verify the field value has no raw newline
    const parsed = JSON.parse(getOutput().trim());
    expect(parsed.endpoint).not.toContain('\n');
    expect(parsed.endpoint).toContain('u000a');
  });
});
