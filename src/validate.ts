import { z } from "zod";

export interface ValidationSchemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
  headers?: z.ZodType;
}

export interface ValidationResult {
  success: boolean;
  data?: Record<string, unknown>;
  errors?: Record<string, string[]>;
}

export interface ValidatedRequest {
  body?: unknown;
  query?: unknown;
  params?: unknown;
  headers?: unknown;
}

function parseSchema(
  schema: z.ZodType,
  value: unknown,
  label: string
): { success: true; data: unknown } | { success: false; errors: string[] } {
  try {
    const data = schema.parse(value);
    return { success: true, data };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const errors = err.issues.map((i) => `${label}.${i.path.join(".")}: ${i.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: [`${label}: Invalid value`] };
  }
}

export function validateRequest(
  schemas: ValidationSchemas,
  request: { body?: unknown; query?: unknown; params?: unknown; headers?: unknown }
): ValidationResult {
  const allErrors: Record<string, string[]> = {};
  const result: Record<string, unknown> = {};

  for (const [key, schema] of Object.entries(schemas)) {
    if (!schema) continue;
    const input = request[key as keyof typeof request];
    const parsed = parseSchema(schema, input, key);
    if (!parsed.success) {
      allErrors[key] = parsed.errors;
    } else {
      result[key] = parsed.data;
    }
  }

  if (Object.keys(allErrors).length > 0) {
    return { success: false, errors: allErrors };
  }

  return { success: true, data: result };
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request) => {
    const url = new URL(req.url);

    const searchParams: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      searchParams[k] = v;
    });

    const result = validateRequest(schemas, {
      body: req.body,
      query: searchParams,
      headers: Object.fromEntries(req.headers.entries()),
    });

    return result;
  };
}
