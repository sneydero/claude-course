import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError, NotFoundError } from './errors.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError('Ruta no encontrada'));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  // Errores de body-parser (JSON malformado, payload demasiado grande...)
  const status: number =
    err instanceof HttpError
      ? err.status
      : typeof err?.status === 'number' && err.status >= 400 && err.status < 500
        ? err.status
        : 500;

  if (status >= 500) {
    console.error(err);
    res.status(500).json({ error: { code: 'internal_error', message: 'Error interno del servidor' } });
    return;
  }

  const code = err instanceof HttpError ? err.code : 'bad_request';
  const message = err instanceof HttpError ? err.message : 'Solicitud inválida';
  res.status(status).json({ error: { code, message } });
};
