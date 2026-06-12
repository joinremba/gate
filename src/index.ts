import { validateRequest } from "./validate";
import { ok, fail, paginated, problem } from "./respond";
import { idempotency, InMemoryStore } from "./idempotency";
import { rateLimit, InMemoryRateLimitStore, keyByApiKey } from "./rate-limit";
import { createApiKeyValidator } from "./api-keys";
import type { ApiKeyEntry, AuthenticateResult } from "./api-keys";
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
  keyByApiKey,
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
  ApiKeyValidatorOptions,
} from "./api-keys";

export type Middleware = (req: Request, next?: () => Promise<Response>) => Promise<Response | null>;

export interface MiddlewareOptions {
  auth?: boolean;
  requiredScopes?: string[];
  rateLimit?: boolean;
  idempotency?: boolean;
  /** Override the max for this specific middleware. */
  rateLimitMax?: number;
  /** Paths to skip entirely. */
  excludePaths?: string[];
}

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
    store?: IdempotencyStore;
    keyFn?: (req: Request) => string;
  };
}

export type MiddlewareResult =
  | {
      passed: true;
      auth?: { key: string; scopes?: string[] };
      rateLimit?: { remaining: number; reset: number };
    }
  | { passed: false; status: number; body: unknown };

export interface Gate {
  validate: typeof validateRequest;
  ok: typeof ok;
  fail: typeof fail;
  paginated: typeof paginated;
  problem: typeof problem;
  idempotency: ReturnType<typeof idempotency>;
  rateLimit: ReturnType<typeof rateLimit>;
  apiKeys: ReturnType<typeof createApiKeyValidator>;
  middleware(opts?: MiddlewareOptions): Middleware;
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

  const defaultFail = (message: string, code?: string) => fail(message, code ?? "UNAUTHORIZED");

  const gate: Gate = {
    validate: validateRequest,
    ok,
    fail,
    paginated,
    problem,
    idempotency: idempInstance,
    rateLimit: rlInstance,
    apiKeys: apiKeyValidator,

    middleware(opts?: MiddlewareOptions) {
      const {
        auth = options.apiKeys != null && options.apiKeys.length > 0,
        requiredScopes,
        rateLimit: enableRl = options.rateLimit != null,
        idempotency: enableIdem = false,
        excludePaths = [],
      } = opts ?? {};

      return async (req: Request, next?: () => Promise<Response>) => {
        if (!next) return null;

        const path = new URL(req.url).pathname;
        if (excludePaths.some((p) => path === p || path.startsWith(p))) {
          return next();
        }

        // Rate limit check
        if (enableRl) {
          const rlResult = await rlInstance.check(req);
          if (!rlResult.allowed) {
            const body = defaultFail("Too many requests", "RATE_LIMIT_EXCEEDED");
            return new Response(JSON.stringify(body), {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": String(Math.ceil((rlResult.reset - Date.now()) / 1000)),
                "X-RateLimit-Remaining": "0",
              },
            });
          }
          req.headers.set("X-RateLimit-Remaining", String(rlResult.remaining));
        }

        // Auth check
        if (auth) {
          const authFn = apiKeyValidator.authenticate({ requiredScopes });
          const authResult = await (authFn(req) as
            | Promise<AuthenticateResult>
            | AuthenticateResult);
          if (!authResult.authenticated) {
            const body = defaultFail(authResult.error ?? "Unauthorized", "AUTHENTICATION_ERROR");
            return new Response(JSON.stringify(body), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
          (req as unknown as Record<string, unknown>).gateAuth = authResult;
        }

        // Idempotency check
        if (enableIdem) {
          const idemKey = req.headers.get(idempInstance.keyHeader);
          if (idemKey) {
            const cached = await idempInstance.getResponse(idemKey);
            if (cached) {
              return new Response(JSON.stringify(cached), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }
            (req as unknown as Record<string, unknown>).gateIdempotencyKey = idemKey;
          }
        }

        const response = await next();
        if (!response) return null;

        // Store response for idempotency
        if (enableIdem) {
          const idemKey = (req as unknown as Record<string, unknown>).gateIdempotencyKey as
            | string
            | undefined;
          if (idemKey && response.status < 500) {
            const body = await response.clone().json();
            await idempInstance.setResponse(idemKey, body);
          }
        }

        return response;
      };
    },
  };

  return gate;
}

export default createGate;
