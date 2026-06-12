export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ErrorPayload {
  message: string;
  code?: string;
  details?: unknown;
}

export interface ErrorResponse {
  success: false;
  error: ErrorPayload;
}

export interface PaginatedResponse<T = unknown> {
  success: true;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
}

export type StructuredResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export function ok<T>(data: T): SuccessResponse<T> {
  return { success: true, data };
}

export function fail(message: string, code?: string, details?: unknown): ErrorResponse {
  return {
    success: false,
    error: { message, code, details },
  };
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

export function problem(detail: ProblemDetails): ErrorResponse & { problem: ProblemDetails } {
  return {
    success: false,
    error: {
      message: detail.title,
      code: detail.type,
      details: detail.detail,
    },
    problem: detail,
  };
}
