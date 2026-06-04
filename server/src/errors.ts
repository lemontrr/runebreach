export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(msg = 'Bad Request') {
    super(msg, 400, 'VALIDATION_ERROR');
  }
}

export class AuthError extends AppError {
  constructor(msg = 'Unauthorized') {
    super(msg, 401, 'AUTH_ERROR');
  }
}

export class ForbiddenError extends AppError {
  constructor(msg = 'Forbidden') {
    super(msg, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(msg = 'Not Found') {
    super(msg, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(msg = 'Conflict') {
    super(msg, 409, 'CONFLICT');
  }
}
