import { NextResponse } from "next/server";

import { errorResponse } from "@/app/api/_utils";
import { scheduleCampaignFollowup } from "@/lib/workflow";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(
      { followup: scheduleCampaignFollowup(id, await request.json()) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
