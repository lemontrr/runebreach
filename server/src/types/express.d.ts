import type { AuthContext } from '../middleware/requireAuth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
