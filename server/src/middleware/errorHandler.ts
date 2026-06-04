import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors.js';
import { logger } from '../logger.js';

const GENERIC: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  415: 'Unsupported Media Type',
  429: 'Too Many Requests',
};

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const playerId = (req as Request & { auth?: { playerId: string } }).auth
    ?.playerId;

  if (err instanceof AppError) {
    logger.error(err.message, {
      err,
      playerId,
      endpoint: req.path,
      httpStatus: err.statusCode,
      errorCode: err.errorCode,
    });
    res
      .status(err.statusCode)
      .json({ error: GENERIC[err.statusCode] ?? 'Error' });
    return;
  }

  // Handle Express/body-parser HTTP errors (e.g. PayloadTooLarge, UnsupportedMediaType)
  const httpErr = err as { status?: number; statusCode?: number };
  const httpStatus = httpErr.status ?? httpErr.statusCode;
  if (typeof httpStatus === 'number' && httpStatus >= 400 && httpStatus < 500) {
    logger.warn('HTTP client error', {
      err,
      playerId,
      endpoint: req.path,
      httpStatus,
      errorCode: 'HTTP_ERROR',
    });
    res.status(httpStatus).json({ error: GENERIC[httpStatus] ?? 'Error' });
    return;
  }

  logger.error('Unhandled error', {
    err,
    playerId,
    endpoint: req.path,
    httpStatus: 500,
    errorCode: 'INTERNAL_ERROR',
  });
  res.status(500).json({ error: 'Internal Server Error' });
}
