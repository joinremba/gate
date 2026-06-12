import { validateRequest } from "./validate";
import { ok, fail, paginated, problem } from "./respond";
import { idempotency, InMemoryStore } from "./idempotency";
import { rateLimit, InMemoryRateLimitStore } from "./rate-limit";
import { createApiKeyValidator } from "./api-keys";
import type { ApiKeyEntry } from "./api-keys";
import type { IdempotencyStore } from "./idempotency";
import {
  GateError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  IdempotencyError,
} from "./errors";

export {
  validateRequest,
  ok,
  fail,
  paginated,
  problem,
  idempotency,
  InMemoryStore,
  rateLimit,
  InMemoryRateLimitStore,
  createApiKeyValidator,
  GateError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  IdempotencyError,
};

export type { ValidationSchemas, ValidationResult, ValidatedRequest } from "./validate";
export type {
  SuccessResponse,
  ErrorResponse,
  ErrorPayload,
  PaginatedResponse,
  ProblemDetails,
  StructuredResponse,
} from "./respond";
export type { IdempotencyStore, IdempotencyOptions, IdempotencyInstance } from "./idempotency";
export type {
  RateLimitStore,
  RateLimitOptions,
  RateLimitStrategy,
  RateLimitInstance,
} from "./rate-limit";
export type {
  ApiKeyEntry,
  AuthenticateOptions,
  AuthenticateResult,
  ApiKeyValidator,
} from "./api-keys";

export type Middleware = (req: Request, next?: () => Promise<Response>) => Promise<Response | null>;

export interface GateOptions {
  apiKeys?: ApiKeyEntry[];
  idempotency?: {
    store?: IdempotencyStore;
    keyHeader?: string;
    ttl?: number;
  };
  rateLimit?: {
    windowMs?: number;
    max?: number;
    strategy?: "fixed" | "sliding";
  };
}

export interface Gate {
  validate: typeof validateRequest;
  ok: typeof ok;
  fail: typeof fail;
  paginated: typeof paginated;
  problem: typeof problem;
  idempotency: ReturnType<typeof idempotency>;
  rateLimit: ReturnType<typeof rateLimit>;
  apiKeys: ReturnType<typeof createApiKeyValidator>;
  middleware(): Middleware;
}

export function createGate(options: GateOptions = {}): Gate {
  const idempInstance = idempotency({
    store: options.idempotency?.store ?? new InMemoryStore(),
    keyHeader: options.idempotency?.keyHeader,
    ttl: options.idempotency?.ttl,
  });

  const rlInstance = rateLimit({
    windowMs: options.rateLimit?.windowMs,
    max: options.rateLimit?.max,
  });

  const apiKeyValidator = createApiKeyValidator(options.apiKeys ?? []);

  const gate: Gate = {
    validate: validateRequest,
    ok,
    fail,
    paginated,
    problem,
    idempotency: idempInstance,
    rateLimit: rlInstance,
    apiKeys: apiKeyValidator,

    middleware() {
      return async (req: Request, next?: () => Promise<Response>) => {
        if (!next) return null;
        return next();
      };
    },
  };

  return gate;
}

export default createGate;
