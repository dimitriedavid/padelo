export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(code: string, message: string, details?: unknown): ApiError {
  return new ApiError(400, code, message, details);
}

export function notFound(code: string, message: string): ApiError {
  return new ApiError(404, code, message);
}

export function conflict(code: string, message: string, details?: unknown): ApiError {
  return new ApiError(409, code, message, details);
}

