import { randomUUID } from "crypto";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { loreImportJobs } from "@/src/db/schema";
import { scheduleLoreImportJobProcessing } from "@/src/lib/lore-import-job-after";
import { assertSpaceExists } from "@/src/lib/spaces";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().min(1).max(500_000),
  spaceId: z.string().uuid(),
  fileName: z.string().max(512).optional(),
});

export async function POST(req: Request) {
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
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const space = await assertSpaceExists(db, parsed.data.spaceId);
  if (!space) {
    return Response.json({ ok: false, error: "Space not found" }, { status: 404 });
  }

  const jobId = randomUUID();
  const importBatchId = randomUUID();
  const now = new Date();

  await db.insert(loreImportJobs).values({
    id: jobId,
    spaceId: parsed.data.spaceId,
    importBatchId,
    status: "queued",
    sourceText: parsed.data.text,
    fileName: parsed.data.fileName ?? null,
    plan: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  });

  scheduleLoreImportJobProcessing(jobId);

  return Response.json({
    ok: true,
    jobId,
    importBatchId,
    status: "queued",
  });
}
