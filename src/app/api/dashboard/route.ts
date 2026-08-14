import { NextResponse } from "next/server";

import { errorResponse } from "@/app/api/_utils";
import { dashboard } from "@/lib/workflow";

export const runtime = "nodejs";

export function GET() {
  try {
    return NextResponse.json(dashboard());
  } catch (error) {
    return errorResponse(error);
  }
}
