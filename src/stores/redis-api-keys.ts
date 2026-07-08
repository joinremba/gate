import type { ApiKeyEntry, AuthenticateResult } from "../api-keys";

export interface RedisClient {
  get(key: string): Promise<string | null>;
  hget(key: string, field: string): Promise<string | undefined>;
  hgetall(key: string): Promise<Record<string, string> | null>;
  hset(key: string, data: Record<string, string>): Promise<unknown>;
  set(key: string, value: string, opts?: { ex?: number }): Promise<unknown>;
  del(key: string): Promise<number>;
}

export class RedisApiKeyStore {
  constructor(
    private client: RedisClient,
    private keyPrefix = "permcheck:apikey:"
  ) {}

  async validate(providedKey: string): Promise<AuthenticateResult> {
    const keyHash = await sha256(providedKey);
    const entry = await this.client.hgetall(`${this.keyPrefix}${keyHash}`);
    if (!entry) {
      return { authenticated: false, error: "Invalid API key" };
    }
    const scopes = entry.scopes ? (JSON.parse(entry.scopes) as string[]) : undefined;
    const metadata = entry.metadata
      ? (JSON.parse(entry.metadata) as Record<string, unknown>)
      : undefined;
    return { authenticated: true, key: providedKey, scopes, metadata };
  }

  verify = this.validate;

  authenticate(options: { requiredScopes?: string[]; header?: string } = {}) {
    const header = options.header ?? "Authorization";
    const requiredScopes = options.requiredScopes ?? [];

    return async (req: Request): Promise<AuthenticateResult> => {
      const authHeader = req.headers.get(header);
      if (!authHeader) {
        return { authenticated: false, error: "Missing API key" };
      }

      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const result = await this.verify(token);

      if (!result.authenticated) return result;

      if (requiredScopes.length > 0) {
        const hasScopes = requiredScopes.every((s) => result.scopes?.includes(s));
        if (!hasScopes) {
          return { authenticated: false, error: "Insufficient permissions" };
        }
      }

      return result;
    };
  }

  async setKey(entry: ApiKeyEntry): Promise<void> {
    const keyHash = await sha256(entry.key);
    const data: Record<string, string> = {};
    if (entry.scopes) data.scopes = JSON.stringify(entry.scopes);
    if (entry.metadata) data.metadata = JSON.stringify(entry.metadata);
    await this.client.hset(`${this.keyPrefix}${keyHash}`, data);
  }

  async deleteKey(key: string): Promise<void> {
    const keyHash = await sha256(key);
    await this.client.del(`${this.keyPrefix}${keyHash}`);
  }
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
