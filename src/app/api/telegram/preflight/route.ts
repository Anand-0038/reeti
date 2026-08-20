import { NextResponse } from "next/server";

import { errorResponse, requireWorkerRequest } from "@/app/api/_utils";
import { telegramPreflight } from "@/lib/telegram";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireWorkerRequest(request);
    return NextResponse.json({ preflight: await telegramPreflight() });
  } catch (error) {
    return errorResponse(error);
  }
}
