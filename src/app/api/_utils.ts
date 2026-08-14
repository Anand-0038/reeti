import { NextResponse } from "next/server";

import { statusForError, toPublicError } from "@/lib/errors";

export function errorResponse(error: unknown) {
  const publicError = toPublicError(error);
  return NextResponse.json({ error: publicError }, { status: statusForError(error) });
}
