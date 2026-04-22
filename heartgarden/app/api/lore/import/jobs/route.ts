import { randomUUID } from "crypto";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { loreImportJobs } from "@/src/db/schema";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
  heartgardenApiForbiddenJsonResponse,
} from "@/src/lib/heartgarden-api-boot-context";
import { scheduleLoreImportJobProcessing } from "@/src/lib/lore-import-job-after";
import { assertSpaceExists } from "@/src/lib/spaces";

export const runtime = "nodejs";

/** Smart-import planning runs in `after()`; allow enough time on Vercel for long documents. */
export const maxDuration = 300;

const bodySchema = z.object({
  text: z.string().min(1).max(2_000_000),
  spaceId: z.string().uuid(),
  fileName: z.string().max(512).optional(),
});

function importAttemptId(req: Request): string {
  return req.headers.get("x-heartgarden-import-attempt")?.trim() || "unknown";
}

export async function POST(req: Request) {
  const attemptId = importAttemptId(req);
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) return denied;

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch (error) {
    console.error("[lore-import] jobs invalid json", {
      attemptId,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Invalid request body";
    return Response.json(
      { ok: false, error: parsed.error.flatten(), hint: firstIssue },
      { status: 400 },
    );
  }
  console.info("[lore-import] jobs create request", {
    attemptId,
    spaceId: parsed.data.spaceId,
    textChars: parsed.data.text.length,
    fileName: parsed.data.fileName ?? null,
  });

  const space = await assertSpaceExists(db, parsed.data.spaceId);
  if (!space) {
    return Response.json({ ok: false, error: "Space not found" }, { status: 404 });
  }
  if (!(await gmMayAccessSpaceIdAsync(db, bootCtx, parsed.data.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const jobId = randomUUID();
  const importBatchId = randomUUID();
  const now = new Date();

  try {
    await db.insert(loreImportJobs).values({
      id: jobId,
      spaceId: parsed.data.spaceId,
      importBatchId,
      status: "queued",
      sourceText: parsed.data.text,
      fileName: parsed.data.fileName ?? null,
      plan: null,
      error: null,
      progressPhase: "queued",
      progressStep: null,
      progressTotal: null,
      progressMessage: "Queued for smart import planning",
      progressMeta: { attemptId, stage: "queued" },
      lastProgressAt: now,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error("[lore-import] jobs insert failed", {
      attemptId,
      spaceId: parsed.data.spaceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { ok: false, error: "Could not persist import job" },
      { status: 500 },
    );
  }

  scheduleLoreImportJobProcessing(jobId);

  return Response.json({
    ok: true,
    attemptId,
    jobId,
    importBatchId,
    status: "queued",
  });
}
