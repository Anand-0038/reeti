import { NextResponse } from "next/server";

import { errorResponse } from "@/app/api/_utils";
import { ingestSource } from "@/lib/workflow";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const source = await ingestSource(await request.json());
    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
