## Commands

```bash
bun test                  # Run all tests
bun run typecheck         # TypeScript check (tsc --noEmit)
bun run format            # Prettier
bun run lint              # ESLint
bun run check             # All checks: lint + format:check + typecheck + test
bun run build             # Build to dist/
```

## Architecture

- **`permcheck`** — API safety layer for TypeScript backends: validation, responses, idempotency, rate limiting, API keys.
- **`src/index.ts`** — `createGate(options?)` → returns `Gate` instance with all modules wired together.
- **`src/validate.ts`** — Request validation with Zod schemas (`validateRequest`, `validate`).
- **`src/respond.ts`** — Structured response builders (`ok`, `fail`, `paginated`, `problem` — RFC 9457).
- **`src/rate-limit.ts`** — Rate limiter (in-memory store, `check()`, `keyByApiKey`).
- **`src/idempotency.ts`** — Idempotency guard (in-memory store with TTL).
- **`src/api-keys.ts`** — In-memory API key validator (`createApiKeyValidator`).
- **`src/errors.ts`** — Typed error hierarchy: `GateError` → `ValidationError | AuthenticationError | RateLimitError | IdempotencyError`.
- **`src/stores/`** — Persistence stores: Redis (`fromIORedis`), Postgres (auto-migration).
- **`src/adapters/hono.ts`** — Hono framework adapter (`createRateLimiter`, `requireIdempotencyKey`, `gateMiddleware`).

## Patterns

- **Framework-agnostic core** — All modules work with any runtime supporting `Request`.
- **Pluggable stores** — Rate limit, idempotency, and API key stores follow interfaces; in-memory by default, Redis/Postgres as deep imports.
- **Cloud-first with local fallback** — When `client` provided, tries remote first, falls back to local on `NetworkError`.
- **Combined middleware** — `gate.middleware()` runs auth + rate-limit + idempotency in one pass using `WeakMap` stores.
- **Tree-shakeable** — All modules importable individually via subpath exports.
- **All source in `src/`**, tests colocated: `src/*.test.ts`.
