# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] — 2026-06-12

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
