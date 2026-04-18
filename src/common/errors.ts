export abstract class AppError extends Error {
  public abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  public readonly statusCode = 404;

  constructor(resource: string, id: string) {
    super(`${resource} with id "${id}" not found`);
  }
}

export class BadRequestError extends AppError {
  public readonly statusCode = 400;
}

export class InternalError extends AppError {
  public readonly statusCode = 500;

  constructor(message = 'Internal server error') {
    super(message);
  }
}
