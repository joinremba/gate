import type { ApiKeyEntry, AuthenticateResult } from "../api-keys";

export interface PostgresClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const TABLE_NAME = "permcheck_api_keys";

export class PostgresApiKeyStore {
  constructor(
    private client: PostgresClient,
    private tableName: string = TABLE_NAME
  ) {}

  async ensureTable(): Promise<void> {
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        key_hash TEXT PRIMARY KEY,
        scopes TEXT,
        metadata TEXT,
        created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
        expires_at BIGINT
      )
    `);
  }

  async validate(providedKey: string): Promise<AuthenticateResult> {
    const keyHash = await sha256(providedKey);
    const { rows } = await this.client.query(
      `SELECT key_hash, scopes, metadata, expires_at FROM ${this.tableName} WHERE key_hash = $1`,
      [keyHash]
    );
    const row = rows[0];
    if (!row) {
      return { authenticated: false, error: "Invalid API key" };
    }

    const expiresAt = row.expires_at as number | null;
    if (expiresAt && Date.now() > expiresAt) {
      return { authenticated: false, error: "API key expired" };
    }

    const scopes = row.scopes ? (JSON.parse(row.scopes as string) as string[]) : undefined;
    const metadata = row.metadata
      ? (JSON.parse(row.metadata as string) as Record<string, unknown>)
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

  async setKey(entry: ApiKeyEntry, expiresAt?: number): Promise<void> {
    const keyHash = await sha256(entry.key);
    await this.client.query(
      `INSERT INTO ${this.tableName} (key_hash, scopes, metadata, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key_hash) DO UPDATE
         SET scopes = $2, metadata = $3, expires_at = $4`,
      [
        keyHash,
        entry.scopes ? JSON.stringify(entry.scopes) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        expiresAt ?? null,
      ]
    );
  }

  async deleteKey(key: string): Promise<void> {
    const keyHash = await sha256(key);
    await this.client.query(`DELETE FROM ${this.tableName} WHERE key_hash = $1`, [keyHash]);
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
