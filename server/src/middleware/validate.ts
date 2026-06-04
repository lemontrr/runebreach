import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../logger.js';

export function validate(schema: ZodSchema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      logger.warn('Input validation failure', {
        endpoint: req.path,
        httpStatus: 400,
        errorCode: 'VALIDATION_ERROR',
        playerId: (req as Request & { auth?: { playerId: string } }).auth?.playerId,
      });
      // No field names or schema details in client response (SECURITY.md §Input Validation)
      res.status(400).json({ error: 'Bad Request' });
      return;
    }
    req.body = result.data;
    next();
  };
}
