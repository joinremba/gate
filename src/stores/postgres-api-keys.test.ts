import { expect, test } from "bun:test";
import { PostgresApiKeyStore, type PostgresClient } from "./postgres-api-keys";

function mockPostgresClient(): PostgresClient {
  const tables: Record<string, Map<string, Record<string, unknown>>> = {};
  return {
    async query(sql: string, params?: unknown[]) {
      const tableMatch = sql.match(/(?:FROM|INTO|UPDATE|TABLE)\s+(\w+)/i);
      const tableName = tableMatch?.[1] ?? "unknown";
      if (!tables[tableName]) tables[tableName] = new Map();
      const table = tables[tableName];

      if (sql.includes("CREATE TABLE IF NOT EXISTS")) {
        return { rows: [] };
      }

      if (sql.includes("DELETE")) {
        if (params?.[0]) table.delete(params[0] as string);
        return { rows: [] };
      }

      if (sql.includes("SELECT") && sql.includes("WHERE key_hash = $1")) {
        const keyHash = params?.[0] as string;
        const entry = table.get(keyHash);
        if (!entry) return { rows: [] };
        return { rows: [entry] };
      }

      if (sql.includes("INSERT") && sql.includes("ON CONFLICT")) {
        const keyHash = params?.[0] as string;
        table.set(keyHash, {
          key_hash: keyHash,
          scopes: params?.[1],
          metadata: params?.[2],
          expires_at: params?.[3],
        });
        return { rows: [] };
      }

      return { rows: [] };
    },
  };
}

test("PostgresApiKeyStore validate and setKey", async () => {
  const client = mockPostgresClient();
  const store = new PostgresApiKeyStore(client);
  await store.ensureTable();
  await store.setKey({ key: "sk-live-test", scopes: ["admin"] });

  const result = await store.validate("sk-live-test");
  expect(result.authenticated).toBe(true);
  expect(result.scopes).toEqual(["admin"]);
});

test("PostgresApiKeyStore rejects unknown key", async () => {
  const client = mockPostgresClient();
  const store = new PostgresApiKeyStore(client);
  await store.ensureTable();
  const result = await store.validate("sk-unknown");
  expect(result.authenticated).toBe(false);
});

test("PostgresApiKeyStore rejects expired key", async () => {
  const client = mockPostgresClient();
  const store = new PostgresApiKeyStore(client);
  await store.ensureTable();
  await store.setKey({ key: "sk-expired" }, Date.now() - 1000);
  const result = await store.validate("sk-expired");
  expect(result.authenticated).toBe(false);
  expect(result.error).toBe("API key expired");
});

test("PostgresApiKeyStore authenticate middleware", async () => {
  const client = mockPostgresClient();
  const store = new PostgresApiKeyStore(client);
  await store.ensureTable();
  await store.setKey({ key: "sk-auth-test", scopes: ["read"] });

  const auth = store.authenticate({ requiredScopes: ["read"] });
  const req = new Request("http://localhost", {
    headers: { Authorization: "Bearer sk-auth-test" },
  });
  const result = await auth(req);
  expect(result.authenticated).toBe(true);
});
