import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../shared/errors.js';

export interface AuthUser {
  id: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const BEARER_RE = /^Bearer +(\S+)$/i;

/** Exige `Authorization: Bearer <jwt>` y adjunta `req.user`. Responde 401 si falta o es inválido. */
export function createAuthMiddleware({ jwtSecret }: { jwtSecret: string }): RequestHandler {
  if (!jwtSecret) throw new Error('jwtSecret es obligatorio');

  return (req, _res, next) => {
    const header = req.get('authorization');
    if (!header) throw new UnauthorizedError('Token requerido');

    const match = BEARER_RE.exec(header);
    if (!match) throw new UnauthorizedError('Formato de Authorization inválido');

    let payload: jwt.JwtPayload | string;
    try {
      payload = jwt.verify(match[1]!, jwtSecret, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedError('Token inválido o expirado');
    }

    const id = typeof payload === 'object' ? Number(payload.sub) : NaN;
    if (!Number.isInteger(id)) throw new UnauthorizedError('Token inválido o expirado');

    req.user = { id };
    next();
  };
}
