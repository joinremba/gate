export interface IdempotencyStore {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export class InMemoryStore implements IdempotencyStore {
  private store = new Map<string, { value: unknown; expires: number }>();

  async get(key: string): Promise<unknown | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: unknown, ttl: number): Promise<void> {
    this.store.set(key, { value, expires: Date.now() + ttl });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export interface IdempotencyOptions {
  store: IdempotencyStore;
  keyHeader?: string;
  ttl?: number;
}

export function idempotency(options: IdempotencyOptions) {
  const keyHeader = options.keyHeader ?? "Idempotency-Key";
  const ttl = options.ttl ?? 86_400_000; // 24 hours

  return {
    keyHeader,
    ttl,
    store: options.store,

    async getResponse(key: string) {
      return options.store.get(`idemp:${key}`);
    },

    async setResponse(key: string, response: unknown) {
      await options.store.set(`idemp:${key}`, response, ttl);
    },
  };
}

export type IdempotencyInstance = ReturnType<typeof idempotency>;
