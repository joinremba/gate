import { expect, test } from "bun:test";
import { PostgresIdempotencyStore, PostgresRateLimitStore, type PostgresClient } from "./postgres";

function mockPostgresClient(): PostgresClient {
  const tables: Record<string, Map<string, Record<string, unknown>>> = {};
  return {
    async query(sql: string, params?: unknown[]) {
      // rudimentary parser for our specific SQL patterns
      const tableMatch = sql.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i);
      const tableName = tableMatch?.[1] ?? "unknown";
      if (!tables[tableName]) tables[tableName] = new Map();

      const table = tables[tableName];

      if (sql.includes("CREATE TABLE IF NOT EXISTS")) {
        return { rows: [] };
      }

      if (sql.includes("DELETE")) {
        const keyIdx = sql.indexOf("$1");
        if (keyIdx !== -1 && params?.[0]) {
          table.delete(params[0] as string);
        }
        return { rows: [] };
      }

      if (sql.includes("SELECT") && sql.includes("WHERE key = $1")) {
        const key = params?.[0] as string;
        const now = (params?.[1] as number) ?? Date.now();
        const entry = table.get(key);
        if (!entry || (entry.expires_at as number) <= now) {
          return { rows: [] };
        }
        return { rows: [entry] };
      }

      if (sql.includes("INSERT") && sql.includes("ON CONFLICT") && !sql.includes("RETURNING")) {
        const key = params?.[0] as string;
        const value = params?.[1] as string;
        const expiresAt = params?.[2] as number;
        table.set(key, { key, value, expires_at: expiresAt });
        return { rows: [] };
      }

      if (sql.includes("INSERT") && sql.includes("ON CONFLICT") && sql.includes("RETURNING")) {
        const key = params?.[0] as string;
        const reset = params?.[1] as number;
        const now = (params?.[2] as number) ?? Date.now();
        const existing = table.get(key);

        if (existing && (existing.reset_at as number) > now) {
          existing.count = (existing.count as number) + 1;
          return { rows: [{ count: existing.count, reset_at: existing.reset_at }] };
        }

        table.set(key, { key, count: 1, reset_at: reset });
        return { rows: [{ count: 1, reset_at: reset }] };
      }

      return { rows: [] };
    },
  };
}

test("PostgresIdempotencyStore set and get", async () => {
  const client = mockPostgresClient();
  const store = new PostgresIdempotencyStore(client);
  await store.ensureTable();
  await store.set("payment:99", { id: "99", amount: 50 }, 60_000);
  const result = await store.get("payment:99");
  expect(result).toEqual({ id: "99", amount: 50 });
});

test("PostgresIdempotencyStore returns null for expired key", async () => {
  const client = mockPostgresClient();
  const store = new PostgresIdempotencyStore(client);
  await store.ensureTable();
  await store.set("expired-key", "value", -1);
  const result = await store.get("expired-key");
  expect(result).toBeNull();
});

test("PostgresRateLimitStore increment", async () => {
  const client = mockPostgresClient();
  const store = new PostgresRateLimitStore(client);
  await store.ensureTable();
  const first = await store.increment("ip:1.2.3.4", 60_000);
  expect(first.count).toBe(1);
  const second = await store.increment("ip:1.2.3.4", 60_000);
  expect(second.count).toBe(2);
});

test("PostgresRateLimitStore reset", async () => {
  const client = mockPostgresClient();
  const store = new PostgresRateLimitStore(client);
  await store.ensureTable();
  await store.increment("ip:1.2.3.4", 60_000);
  await store.reset("ip:1.2.3.4");
  const result = await store.increment("ip:1.2.3.4", 60_000);
  expect(result.count).toBe(1);
});
