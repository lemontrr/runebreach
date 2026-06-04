import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { config } from '../config.js';
import { logger } from '../logger.js';

// Helmet base + override with SECURITY.md mandatory headers
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", config.corsOrigin],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  hsts: {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true,
  },
  hidePoweredBy: true,
});

export const corsMiddleware = cors({
  origin: config.corsOrigin,
  credentials: false,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Stricter bucket for auth endpoints
export const authRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  // Check env at request time so test environment can toggle without module reload
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    logger.warn('Rate limit exceeded', { endpoint: 'auth', httpStatus: 429 });
    res.status(429).json({ error: 'Too Many Requests' });
  },
});

export const gameRateLimit = rateLimit({
  windowMs: 60_000,
  max: 100,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    logger.warn('Rate limit exceeded', { endpoint: 'game', httpStatus: 429 });
    res.status(429).json({ error: 'Too Many Requests' });
  },
});

// Mandatory no-cache + no-store on all non-catalog responses
export const noCacheHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

// Enforce Content-Type: application/json on mutation endpoints
export const requireJson: RequestHandler = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'Unsupported Media Type' });
    }
  }
  next();
};

// Method allowlist factory
export const allowMethods =
  (...methods: string[]): RequestHandler =>
  (req, res, next) => {
    if (!methods.includes(req.method)) {
      res.setHeader('Allow', methods.join(', '));
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    next();
  };

// Enforce env guard on startup — called once before app.listen
export function assertRequiredEnvVars(): void {
  // config.ts already throws on construction if vars are missing;
  // this is a belt-and-suspenders call site at startup
  void config.databaseUrl;
  void config.jwtSecret;
  void config.webauthn.rpId;
  void config.corsOrigin;
}
