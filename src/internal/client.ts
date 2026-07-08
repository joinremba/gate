interface VerifyKeyResult {
  valid: boolean;
  projectId: string;
  scopes: string[];
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  reset: number;
}

export interface IdempotencyCheckResult {
  exists: boolean;
  response?: unknown;
}

export interface Client {
  /** Verify the API key is valid and return its scopes. */
  verifyKey(): Promise<VerifyKeyResult>;

  /** Check rate limit for a given key. */
  checkRateLimit(key: string): Promise<RateLimitCheckResult>;

  /** Check idempotency for a given key. */
  checkIdempotency(key: string): Promise<IdempotencyCheckResult>;

  /** Store idempotency response for a given key. */
  setIdempotency(key: string, response: unknown): Promise<void>;

  /** Verify an API key server-side. */
  verifyApiKey(key: string): Promise<VerifyKeyResult>;
}
