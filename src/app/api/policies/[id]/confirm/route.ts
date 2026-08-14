import { NextResponse } from "next/server";

import { errorResponse } from "@/app/api/_utils";
import { confirmCreatorPolicy } from "@/lib/workflow";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json({ policy: confirmCreatorPolicy(id) });
  } catch (error) {
    return errorResponse(error);
  }
}
