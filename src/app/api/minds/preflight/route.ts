import { NextResponse } from "next/server";

import { errorResponse } from "@/app/api/_utils";
import { getMindsGateway } from "@/lib/minds";

export const runtime = "nodejs";

export async function POST() {
  try {
    return NextResponse.json({ preflight: await getMindsGateway().preflight() });
  } catch (error) {
    return errorResponse(error);
  }
}
