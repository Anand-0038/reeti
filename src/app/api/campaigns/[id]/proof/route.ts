import { NextResponse } from "next/server";

import { errorResponse } from "@/app/api/_utils";
import { getCampaignProofBundle } from "@/lib/workflow";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(
      { proof: getCampaignProofBundle(id) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
