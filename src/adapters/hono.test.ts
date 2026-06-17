import { expect, test, describe } from "bun:test";
import { Hono } from "hono";
import { createGate } from "../index";
import { createRateLimiter, requireIdempotencyKey, gateMiddleware } from "./hono";

function createApp(
  ...middleware: ReturnType<
    typeof createRateLimiter | typeof requireIdempotencyKey | typeof gateMiddleware
  >[]
): Hono {
  const app = new Hono();
  app.use(...middleware);
  app.post("/test", (c) => c.json({ success: true, data: { id: "1" } }, 201));
  app.get("/safe", (c) => c.json({ ok: true }));
  return app;
}

describe("createRateLimiter", () => {
  test("allows requests within limit", async () => {
    const gate = createGate({ rateLimit: { windowMs: 60000, max: 5 } });
    const app = createApp(createRateLimiter({ gate, keyPrefix: "test" }));

    const res = await app.request("http://localhost/test", { method: "POST" });
    expect(res.status).toBe(201);
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
  });

  test("blocks requests over limit", async () => {
    const gate = createGate({ rateLimit: { windowMs: 60000, max: 0 } });
    const app = createApp(createRateLimiter({ gate, keyPrefix: "test" }));

    const res = await app.request("http://localhost/test", { method: "POST" });
    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("error");
  });

  test("uses custom getKey function", async () => {
    const gate = createGate({ rateLimit: { windowMs: 60000, max: 5 } });
    const app = new Hono();
    app.use(
      createRateLimiter({
        gate,
        keyPrefix: "custom",
        getKey: (c) => c.req.header("x-custom") ?? "unknown",
      })
    );
    app.post("/test", (c) => c.json({ ok: true }, 201));

    const res = await app.request("http://localhost/test", {
      method: "POST",
      headers: { "x-custom": "user-42" },
    });
    expect(res.status).toBe(201);
  });

  test("falls back to clientIp then x-forwarded-for", async () => {
    const gate = createGate({ rateLimit: { windowMs: 60000, max: 5 } });
    const app = new Hono();
    app.use(createRateLimiter({ gate, keyPrefix: "ip" }));
    app.post("/test", (c) => c.json({ ok: true }, 201));

    const res = await app.request("http://localhost/test", {
      method: "POST",
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    expect(res.status).toBe(201);
  });
});

describe("requireIdempotencyKey", () => {
  test("rejects missing key header", async () => {
    const gate = createGate({ idempotency: { ttl: 60000 } });
    const app = createApp(requireIdempotencyKey({ gate }));

    const res = await app.request("http://localhost/test", { method: "POST" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect((body.error as Record<string, unknown>).message).toContain(
      "Idempotency-Key header is required"
    );
  });

  test("rejects invalid key format", async () => {
    const gate = createGate({ idempotency: { ttl: 60000 } });
    const app = createApp(requireIdempotencyKey({ gate }));

    const res = await app.request("http://localhost/test", {
      method: "POST",
      headers: { "Idempotency-Key": "short" },
    });
    expect(res.status).toBe(400);
  });

  test("passes through on GET requests", async () => {
    const gate = createGate({ idempotency: { ttl: 60000 } });
    const app = new Hono();
    app.use(requireIdempotencyKey({ gate }));
    app.get("/safe", (c) => c.json({ ok: true }));

    const res = await app.request("http://localhost/safe");
    expect(res.status).toBe(200);
  });

  test("returns cached response on duplicate key", async () => {
    const gate = createGate({ idempotency: { ttl: 60000 } });
    await gate.idempotency.setResponse("idemp-dup-key", { success: true, data: { id: "cached" } });
    const app = createApp(requireIdempotencyKey({ gate }));

    const res = await app.request("http://localhost/test", {
      method: "POST",
      headers: { "Idempotency-Key": "idemp-dup-key" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect((body.data as Record<string, unknown>).id).toBe("cached");
  });

  test("caches successful response for idempotent re-use", async () => {
    const gate = createGate({ idempotency: { ttl: 60000 } });
    const app = createApp(requireIdempotencyKey({ gate }));

    const res1 = await app.request("http://localhost/test", {
      method: "POST",
      headers: { "Idempotency-Key": "cache-me" },
    });
    expect(res1.status).toBe(201);

    const cached = await gate.idempotency.getResponse("cache-me");
    expect(cached).toBeDefined();
    expect((cached as Record<string, unknown>).data).toBeDefined();
  });
});

describe("gateMiddleware", () => {
  test("passes through when no features configured", async () => {
    const gate = createGate();
    const app = new Hono();
    app.use(gateMiddleware(gate));
    app.post("/test", (c) => c.json({ ok: true }));

    const res = await app.request("http://localhost/test", { method: "POST" });
    expect(res.status).toBe(200);
  });

  test("rejects when auth fails", async () => {
    const gate = createGate({ apiKeys: [{ key: "sk-valid" }] });
    const app = new Hono();
    app.use(gateMiddleware(gate, { auth: true }));
    app.post("/test", (c) => c.json({ ok: true }));

    const res = await app.request("http://localhost/test", {
      method: "POST",
      headers: { Authorization: "Bearer sk-wrong" },
    });
    expect(res.status).toBe(401);
  });

  test("rejects when rate limit exceeded", async () => {
    const gate = createGate({ rateLimit: { windowMs: 60000, max: 0 } });
    const app = new Hono();
    app.use(gateMiddleware(gate, { rateLimit: true }));
    app.post("/test", (c) => c.json({ ok: true }));

    const res = await app.request("http://localhost/test", { method: "POST" });
    expect(res.status).toBe(429);
  });
});
