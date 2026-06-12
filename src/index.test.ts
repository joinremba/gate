import { expect, test, describe } from "bun:test";
import { z } from "zod";
import { createGate, ok, fail, paginated, problem, validateRequest } from "./index";

test("createGate returns a gate instance", () => {
  const gate = createGate();
  expect(gate).toBeDefined();
  expect(typeof gate.validate).toBe("function");
  expect(typeof gate.ok).toBe("function");
  expect(typeof gate.fail).toBe("function");
});

describe("respond", () => {
  test("ok returns success response", () => {
    const res = ok({ id: 1, name: "Alice" });
    expect(res).toEqual({ success: true, data: { id: 1, name: "Alice" } });
  });

  test("fail returns error response", () => {
    const res = fail("Not found", "NOT_FOUND");
    expect(res).toEqual({
      success: false,
      error: { message: "Not found", code: "NOT_FOUND", details: undefined },
    });
  });

  test("paginated returns paginated response", () => {
    const res = paginated([{ id: 1 }], 25, 1, 10);
    expect(res.success).toBe(true);
    expect(res.pagination).toEqual({ total: 25, page: 1, limit: 10, pages: 3 });
  });

  test("problem returns problem-details response", () => {
    const res = problem({
      type: "https://errors.remba.com/rate-limit",
      title: "Rate Limit Exceeded",
      status: 429,
      detail: "Too many requests, please retry later",
    });
    expect(res.success).toBe(false);
    expect(res.problem.title).toBe("Rate Limit Exceeded");
  });
});

describe("validate", () => {
  test("returns success for valid input", () => {
    const schema = z.object({ name: z.string() });
    const result = validateRequest({ body: schema }, { body: { name: "Alice" } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ body: { name: "Alice" } });
    }
  });

  test("returns errors for invalid input", () => {
    const schema = z.object({ name: z.string().min(1) });
    const result = validateRequest({ body: schema }, { body: { name: "" } });
    expect(result.success).toBe(false);
  });

  test("validates query params", () => {
    const schema = z.object({ page: z.coerce.number().int().positive() });
    const result = validateRequest({ query: schema }, { query: { page: "2" } });
    expect(result.success).toBe(true);
  });
});

describe("idempotency", () => {
  test("creates idempotency instance", () => {
    const gate = createGate();
    expect(gate.idempotency.store).toBeDefined();
    expect(gate.idempotency.keyHeader).toBe("Idempotency-Key");
  });

  test("stores and retrieves responses", async () => {
    const gate = createGate({
      idempotency: { ttl: 60000 },
    });

    const response = { status: 201, body: { id: "order-1" } };
    await gate.idempotency.setResponse("test-key", response);
    const cached = await gate.idempotency.getResponse("test-key");
    expect(cached).toEqual(response);
  });
});

describe("rate limit", () => {
  test("allows requests within limit", async () => {
    const gate = createGate({
      rateLimit: { windowMs: 60000, max: 100 },
    });

    const req = new Request("http://localhost/test");
    const result = await gate.rateLimit.check(req);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });
});

describe("api keys", () => {
  test("validates correct API key", () => {
    const gate = createGate({
      apiKeys: [{ key: "sk-valid", scopes: ["read"] }],
    });

    const result = gate.apiKeys.validate("sk-valid");
    expect(result.authenticated).toBe(true);
    expect(result.scopes).toEqual(["read"]);
  });

  test("rejects invalid API key", () => {
    const gate = createGate({ apiKeys: [{ key: "sk-valid" }] });
    const result = gate.apiKeys.validate("sk-invalid");
    expect(result.authenticated).toBe(false);
  });
});
