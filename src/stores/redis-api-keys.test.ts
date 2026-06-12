import { expect, test } from "bun:test";
import { RedisApiKeyStore, type RedisClient } from "./redis-api-keys";

function mockRedisClient(): RedisClient {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async hget(_key: string, _field: string) {
      return undefined;
    },
    async hgetall(key: string) {
      const val = store.get(key);
      if (!val) return null;
      return JSON.parse(val) as Record<string, string>;
    },
    async set(key: string, value: string) {
      store.set(key, value);
    },
    async del(key: string) {
      return store.delete(key) ? 1 : 0;
    },
  };
}

test("RedisApiKeyStore validate and setKey", async () => {
  const client = mockRedisClient();
  const store = new RedisApiKeyStore(client);
  await store.setKey({ key: "sk-redis-test", scopes: ["read"] });

  const result = await store.validate("sk-redis-test");
  expect(result.authenticated).toBe(true);
  expect(result.scopes).toEqual(["read"]);
});

test("RedisApiKeyStore rejects unknown key", async () => {
  const client = mockRedisClient();
  const store = new RedisApiKeyStore(client);
  const result = await store.validate("sk-unknown");
  expect(result.authenticated).toBe(false);
});

test("RedisApiKeyStore supports deleteKey", async () => {
  const client = mockRedisClient();
  const store = new RedisApiKeyStore(client);
  await store.setKey({ key: "sk-deletable" });
  await store.deleteKey("sk-deletable");
  const result = await store.validate("sk-deletable");
  expect(result.authenticated).toBe(false);
});
