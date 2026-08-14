import { NextResponse } from "next/server";

import { errorResponse } from "@/app/api/_utils";
import { ReetiError } from "@/lib/errors";
import { serverEnv } from "@/lib/env";
import { runDueFollowups } from "@/lib/workflow";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
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
    return NextResponse.json({ results: await runDueFollowups() });
  } catch (error) {
    return errorResponse(error);
  }
}
