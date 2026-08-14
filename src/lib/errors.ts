export class ReetiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ReetiError";
  }
}

export function toPublicError(error: unknown): {
  code: string;
  message: string;
  details?: Record<string, unknown>;
} {
  if (error instanceof ReetiError) {
    return { code: error.code, message: error.message, details: error.details };
  }

  if (error instanceof Error) {
    return { code: "INTERNAL_ERROR", message: error.message };
  }

  return { code: "INTERNAL_ERROR", message: "The request could not be completed." };
}

export function statusForError(error: unknown): number {
  return error instanceof ReetiError ? error.status : 500;
}
