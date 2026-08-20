import { NextResponse } from "next/server";

import { ReetiError, statusForError, toPublicError } from "@/lib/errors";
import { serverEnv } from "@/lib/env";

export function errorResponse(error: unknown) {
  const publicError = toPublicError(error);
  return NextResponse.json({ error: publicError }, { status: statusForError(error) });
}

export function requireWorkerRequest(request: Request): void {
  if (!serverEnv.workerSecret) {
    throw new ReetiError(
      "Set REETI_WORKER_SECRET before exposing the local worker route.",
      "WORKER_NOT_CONFIGURED",
      503,
    );
  }
  if (request.headers.get("x-reeti-worker-secret") !== serverEnv.workerSecret) {
    throw new ReetiError("The worker secret was not accepted.", "WORKER_UNAUTHORIZED", 401);
  }
}
