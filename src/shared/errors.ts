export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = 'error',
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Recurso no encontrado') {
    super(404, message, 'not_found');
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Solicitud inválida') {
    super(400, message, 'bad_request');
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Credenciales inválidas') {
    super(401, message, 'unauthorized');
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'El recurso ya existe') {
    super(409, message, 'conflict');
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'No tienes permiso para esta acción') {
    super(403, message, 'forbidden');
  }
}
