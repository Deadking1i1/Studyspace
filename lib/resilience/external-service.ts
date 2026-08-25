export class ExternalServiceError extends Error {
  readonly service: string;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(service: string, options: { cause?: unknown; retryable?: boolean; status?: number } = {}) {
    super(`${service} is temporarily unavailable.`, { cause: options.cause });
    this.name = "ExternalServiceError";
    this.service = service;
    this.retryable = options.retryable ?? true;
    this.status = options.status;
  }
}

export function safeExternalError(error: unknown) {
  if (error instanceof ExternalServiceError) {
    return { error: error.message, retryable: error.retryable };
  }
  return { error: "The external service could not complete the request.", retryable: true };
}
