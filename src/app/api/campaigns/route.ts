import { NextResponse } from "next/server";

import { errorResponse } from "@/app/api/_utils";
import { generateCampaign } from "@/lib/workflow";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sourceId?: string };
    if (!body.sourceId)
      return NextResponse.json(
        { error: { code: "SOURCE_ID_REQUIRED", message: "A source is required." } },
        { status: 422 },
      );
    const result = await generateCampaign(body.sourceId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
