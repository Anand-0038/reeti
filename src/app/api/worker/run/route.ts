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
    const mode = request.headers.get("x-reeti-worker-mode")?.trim();
    if (mode && mode !== "scheduled" && mode !== "manual") {
      throw new ReetiError(
        "Worker mode must be either scheduled or manual.",
        "WORKER_MODE_INVALID",
        422,
      );
    }
    const manualTrigger = mode !== "scheduled";
    return NextResponse.json({
      manualTrigger,
      results: await runDueFollowups({ manualTrigger }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
