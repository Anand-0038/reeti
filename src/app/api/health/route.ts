import { NextResponse } from "next/server";

import { getProviderStatus } from "@/lib/env";
import { ensureCreator } from "@/lib/store";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "reeti",
    boundary: "local",
    creator: ensureCreator(),
    provider: getProviderStatus(),
    time: new Date().toISOString(),
  });
}
