import pino, { DestinationStream } from 'pino';
import { config } from './config.js';

// Match display_name/displayName and any trailing value (key=value or key:value forms)
const PII_PATTERN = /(display_name|displayName)[^\s,}"]*/gi;
const TOKEN_PATTERN = /bearer\s+[\w.-]+/gi;
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

export function sanitize(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value
    .replace(TOKEN_PATTERN, '[REDACTED_TOKEN]')
    .replace(PII_PATTERN, '[REDACTED_PII]')
    .replace(CONTROL_CHARS, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, sanitize(v)])
  );
}

export interface LogContext {
  playerId?: string;
  endpoint?: string;
  httpStatus?: number;
  errorCode?: string;
  err?: unknown;
}

export function createLogger(destination?: DestinationStream) {
  const base = pino(
    {
      level: config.logLevel,
      formatters: { level: (label) => ({ level: label }) },
      timestamp: pino.stdTimeFunctions.isoTime,
      serializers: { err: pino.stdSerializers.err },
    },
    destination ?? pino.destination(1),
  );

  return {
    info: (msg: string, ctx: LogContext = {}) =>
      base.info(sanitizeObject(ctx as Record<string, unknown>), msg),
    warn: (msg: string, ctx: LogContext = {}) =>
      base.warn(sanitizeObject(ctx as Record<string, unknown>), msg),
    error: (msg: string, ctx: LogContext & { err?: unknown } = {}) =>
      base.error(sanitizeObject(ctx as Record<string, unknown>), msg),
    debug: (msg: string, ctx: LogContext = {}) =>
      base.debug(sanitizeObject(ctx as Record<string, unknown>), msg),
  };
}

export const logger = createLogger();
