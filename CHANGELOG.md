# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] — 2026-06-12

### Added

- **Hashed API keys** — `createApiKeyValidator(keys, { hashKeys: true })` stores SHA-256 hashes instead of plaintext. New `verify(token)` method for async hash comparison.
- **DB-backed API key stores** — `PostgresApiKeyStore` and `RedisApiKeyStore` validate keys against a `gate_api_keys` table / Redis hash. Support `setKey()`, `deleteKey()`, and key expiry.
- **Combined middleware** — `gate.middleware({ auth, rateLimit, idempotency })` runs all checks in one call. Rejects with proper status codes (401, 429). Supports `excludePaths`.
- **Per-key rate limiting helper** — `keyByApiKey(req)` extracts Bearer token from Authorization header for use as rate limit key.
- `@joinremba/gate/stores/redis-api-keys` and `@joinremba/gate/stores/postgres-api-keys` sub-module exports.

### Added

- Redis store for idempotency (`RedisIdempotencyStore`) — implements `IdempotencyStore` via `GET`, `SETEX`, `DEL`
- Redis store for rate limiting (`RedisRateLimitStore`) — implements `RateLimitStore` via `INCR`, `EXPIRE`, `DEL`
- Postgres store for idempotency (`PostgresIdempotencyStore`) — implements `IdempotencyStore` via key-value table with TTL expiry
- Postgres store for rate limiting (`PostgresRateLimitStore`) — implements `RateLimitStore` via counter table with sliding window
- Package exports for both stores: `@joinremba/gate/stores/redis` and `@joinremba/gate/stores/postgres`

## [0.1.0] — 2026-06-12

### Added

- Initial release
- Request validation (body, query, params, headers) with Zod schemas
- Structured JSON response envelope
- Idempotency key support for safe retries
- API key authentication with scoped permissions
- Configurable rate limiting
