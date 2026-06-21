import { expect, test } from "bun:test";
import { RedisApiKeyStore, type RedisClient } from "./redis-api-keys";

function mockRedisClient(): RedisClient {
  const hashes = new Map<string, Record<string, string>>();
  return {
    async get(key: string) {
      const h = hashes.get(key);
      if (!h) return null;
      return JSON.stringify(h);
    },
    async hget(_key: string, _field: string) {
      return undefined;
    },
    async hgetall(key: string) {
      return hashes.get(key) ?? null;
    },
    async hset(key: string, data: Record<string, string>) {
      hashes.set(key, { ...hashes.get(key), ...data });
    },
    async set(key: string, value: string) {
      hashes.set(key, JSON.parse(value) as Record<string, string>);
    },
    async del(key: string) {
      return hashes.delete(key) ? 1 : 0;
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
