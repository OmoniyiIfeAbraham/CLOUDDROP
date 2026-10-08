export interface ApiErrorOptions {
  message: string;
  code: string;
  status?: number;
  retryable?: boolean;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = "ApiError";
    this.code = options.code;
    this.retryable = options.retryable ?? false;

    if (options.status !== undefined) {
      this.status = options.status;
    }

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const isApiError = (value: unknown): value is ApiError =>
  value instanceof ApiError;
