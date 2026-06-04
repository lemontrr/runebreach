import {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../src/errors';

describe('Error classes', () => {
  it('ValidationError has correct statusCode and errorCode', () => {
    const e = new ValidationError();
    expect(e.statusCode).toBe(400);
    expect(e.errorCode).toBe('VALIDATION_ERROR');
    expect(e).toBeInstanceOf(AppError);
  });

  it('AuthError has correct statusCode', () => {
    const e = new AuthError();
    expect(e.statusCode).toBe(401);
    expect(e.errorCode).toBe('AUTH_ERROR');
  });

  it('ForbiddenError has correct statusCode', () => {
    const e = new ForbiddenError('nope');
    expect(e.statusCode).toBe(403);
    expect(e.message).toBe('nope');
  });

  it('NotFoundError has correct statusCode', () => {
    expect(new NotFoundError().statusCode).toBe(404);
  });

  it('ConflictError has correct statusCode', () => {
    expect(new ConflictError().statusCode).toBe(409);
  });

  it('AppError name matches constructor name', () => {
    expect(new ValidationError().name).toBe('ValidationError');
    expect(new AuthError().name).toBe('AuthError');
  });

  it('default message used when no arg provided', () => {
    expect(new ForbiddenError().message).toBe('Forbidden');
    expect(new NotFoundError().message).toBe('Not Found');
    expect(new ConflictError().message).toBe('Conflict');
  });

  it('custom message overrides default', () => {
    expect(new ForbiddenError('no access').message).toBe('no access');
    expect(new ConflictError('already exists').message).toBe('already exists');
  });
});
