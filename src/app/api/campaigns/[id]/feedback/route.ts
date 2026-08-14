import { NextResponse } from "next/server";

import { errorResponse } from "@/app/api/_utils";
import { recordCampaignFeedback } from "@/lib/workflow";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(await recordCampaignFeedback(id, await request.json()), {
      status: 201,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
