export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; reset: number }>;
  reset(key: string): Promise<void>;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; reset: number }>();

  async increment(key: string, windowMs: number): Promise<{ count: number; reset: number }> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.reset) {
      const reset = now + windowMs;
      this.store.set(key, { count: 1, reset });
      return { count: 1, reset };
    }

    entry.count += 1;
    return { count: entry.count, reset: entry.reset };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export type RateLimitStrategy = "fixed" | "sliding";

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  strategy?: RateLimitStrategy;
  store?: RateLimitStore;
  keyFn?: (req: Request) => string;
}

export function rateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 100;
  const store = options.store ?? new InMemoryRateLimitStore();
  const keyFn =
    options.keyFn ??
    ((req: Request) => {
      const forwarded = req.headers.get("x-forwarded-for");
      return forwarded ?? "global";
    });

  return {
    windowMs,
    max,
    store,
    keyFn,

    async check(req: Request): Promise<{ allowed: boolean; remaining: number; reset: number }> {
      const key = keyFn(req);
      const { count, reset } = await store.increment(`rl:${key}`, windowMs);
      return {
        allowed: count <= max,
        remaining: Math.max(0, max - count),
        reset,
      };
    },
  };
}

export type RateLimitInstance = ReturnType<typeof rateLimit>;
