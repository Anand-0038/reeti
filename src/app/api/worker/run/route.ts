import { NextResponse } from "next/server";

import { errorResponse, requireWorkerRequest } from "@/app/api/_utils";
import { ReetiError } from "@/lib/errors";
import { runDueFollowups } from "@/lib/workflow";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireWorkerRequest(request);
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
