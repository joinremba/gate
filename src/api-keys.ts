export interface ApiKeyEntry {
  key: string;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

export interface AuthenticateOptions {
  requiredScopes?: string[];
  header?: string;
}

export interface AuthenticateResult {
  authenticated: boolean;
  key?: string;
  scopes?: string[];
  error?: string;
}

export function createApiKeyValidator(keys: ApiKeyEntry[]) {
  const keyMap = new Map(keys.map((k) => [k.key, k]));

  return {
    validate(providedKey: string): AuthenticateResult {
      const entry = keyMap.get(providedKey);
      if (!entry) {
        return { authenticated: false, error: "Invalid API key" };
      }
      return { authenticated: true, key: entry.key, scopes: entry.scopes };
    },

    authenticate(options: AuthenticateOptions = {}) {
      const header = options.header ?? "Authorization";
      const requiredScopes = options.requiredScopes ?? [];

      return (req: Request): AuthenticateResult => {
        const authHeader = req.headers.get(header);
        if (!authHeader) {
          return { authenticated: false, error: "Missing API key" };
        }

        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        const result = this.validate(token);

        if (!result.authenticated) return result;

        if (requiredScopes.length > 0) {
          const hasScopes = requiredScopes.every((s) => result.scopes?.includes(s));
          if (!hasScopes) {
            return { authenticated: false, error: "Insufficient permissions" };
          }
        }

        return result;
      };
    },
  };
}

export type ApiKeyValidator = ReturnType<typeof createApiKeyValidator>;
