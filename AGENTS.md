# @remba/gate

API safety layer for TypeScript backends: validation, responses, idempotency, rate limiting, and API keys.

## Commands

| Command             | Description                            |
| ------------------- | -------------------------------------- |
| `bun test`          | Run tests                              |
| `bun run typecheck` | `tsc --noEmit`                         |
| `bun run lint`      | ESLint                                 |
| `bun run format`    | Prettier                               |
| `bun run check`     | lint + format:check + typecheck + test |
| `bun run build`     | Build to `dist/`                       |

## Stack

- TypeScript 6 (strict), Bun runtime, Zod ^4.4.2
- ESLint 8 + Prettier for code quality

## Key API

- `createGate(options?)` — Main export. Returns a Gate instance with all modules.
- `gate.validate(schemas, request)` — Validate body/query/params/headers with Zod.
- `gate.ok(data)` / `gate.fail(msg, code?)` — Response helpers.
- `gate.paginated(data, total, page, limit)` — Paginated responses.
- `gate.problem(detail)` — RFC 9457 problem details.
- `gate.idempotency` — Idempotency guard (getResponse/setResponse).
- `gate.rateLimit` — Rate limiter (check).
- `gate.apiKeys` — API key validator (validate/authenticate).

## Deep Imports

All modules importable individually:

- `@remba/gate/validate`
- `@remba/gate/respond`
- `@remba/gate/idempotency`
- `@remba/gate/rate-limit`
- `@remba/gate/api-keys`
- `@remba/gate/errors`

## Patterns

- All source in `src/`
- Tests colocated with source: `src/*.test.ts`
- One sub-module per file, exported via package.json `exports`
- Zod schemas for all validation
- Framework-agnostic design (plain functions, not tied to any HTTP lib)
- In-memory stores for MVP; replaceable via interfaces

## npm Publishing

- `publishConfig.access: public`
- CI publishes on `v*` tags via `npm publish --provenance`
- `NPM_TOKEN` secret required in GitHub

## Config Reference

| Field        | Value         |
| ------------ | ------------- |
| Package name | `@remba/gate` |
| Licence      | MIT           |
| Engine       | `bun >=1.3.1` |
| Runtime deps | zod           |
