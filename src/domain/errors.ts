/**
 * Application and storage error types.
 */

export class StorageError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AppError extends Error {
  readonly cause?: unknown;
  readonly code?: string;

  constructor(message: string, options?: { cause?: unknown; code?: string }) {
    super(message);
    this.name = 'AppError';
    this.cause = options?.cause;
    this.code = options?.code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function formatErrorForDiagnostics(error: unknown): string {
  if (error instanceof StorageError || error instanceof AppError) {
    return `${error.name}: ${error.message}`;
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}
