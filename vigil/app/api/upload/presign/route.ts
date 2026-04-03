import { NextResponse } from "next/server";

/** Stub for Cloudflare R2 presigned uploads (Phase 3). */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "R2 presign not configured. Set R2 credentials in a later deploy.",
    },
    { status: 501 },
  );
}
