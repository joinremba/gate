export class PermcheckError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 500) {
    super(message);
    this.name = "PermcheckError";
    this.code = code;
    this.status = status;
  }
}

export class ValidationError extends PermcheckError {
  readonly issues: unknown[];

  constructor(message: string, issues: unknown[] = []) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

export class AuthenticationError extends PermcheckError {
  constructor(message = "Unauthorized") {
    super(message, "AUTHENTICATION_ERROR", 401);
    this.name = "AuthenticationError";
  }
}

export class RateLimitError extends PermcheckError {
  readonly retryAfter: number;

  constructor(retryAfter = 60) {
    super("Too many requests", "RATE_LIMIT_ERROR", 429);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class IdempotencyError extends PermcheckError {
  constructor(message = "Idempotency key conflict") {
    super(message, "IDEMPOTENCY_ERROR", 409);
    this.name = "IdempotencyError";
  }
}

export function isPermcheckError(err: unknown): err is PermcheckError {
  return err instanceof PermcheckError;
}
