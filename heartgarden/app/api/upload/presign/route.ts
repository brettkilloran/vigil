import { NextResponse } from "next/server";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
} from "@/src/lib/heartgarden-api-boot-context";
import { presignImagePut, readR2Env } from "@/src/lib/r2-upload";

const bodySchema = z.object({
  contentType: z.string().max(128),
  filename: z.string().max(255).optional(),
  spaceId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) {
    return denied;
  }

  const env = readR2Env();
  if (!env) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_BASE_URL (public bucket URL, no trailing slash).",
        code: "R2_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid body", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const ct = parsed.data.contentType.toLowerCase();
  if (!ct.startsWith("image/")) {
    return NextResponse.json(
      {
        ok: false,
        error: "Only image/* content types are allowed.",
        code: "INVALID_TYPE",
      },
      { status: 400 }
    );
  }

  if (parsed.data.spaceId) {
    const db = tryGetDb();
    if (!db) {
      return NextResponse.json(
        { ok: false, error: "Database not configured", code: "DB_UNAVAILABLE" },
        { status: 503 }
      );
    }
    if (!(await gmMayAccessSpaceIdAsync(db, bootCtx, parsed.data.spaceId))) {
      return NextResponse.json(
        { ok: false, error: "Forbidden.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }
  }

  try {
    const { uploadUrl, publicUrl, key } = await presignImagePut(env, {
      contentType: parsed.data.contentType,
      filename: parsed.data.filename,
      spaceId: parsed.data.spaceId,
    });
    return NextResponse.json({
      ok: true,
      uploadUrl,
      publicUrl,
      key,
      headers: { "Content-Type": parsed.data.contentType },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Presign failed";
    return NextResponse.json(
      { ok: false, error: message, code: "PRESIGN_FAILED" },
      { status: 500 }
    );
  }
}
