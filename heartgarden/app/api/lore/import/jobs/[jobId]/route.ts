import { eq } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { loreImportJobs } from "@/src/db/schema";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
  heartgardenApiForbiddenJsonResponse,
} from "@/src/lib/heartgarden-api-boot-context";
import { scheduleLoreImportJobProcessing } from "@/src/lib/lore-import-job-after";
import {
  STALE_LORE_IMPORT_PROCESSING_MS,
} from "@/src/lib/lore-import-job-process";
import { loreImportPlanSchema } from "@/src/lib/lore-import-plan-types";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ jobId: string }> };

export async function GET(req: Request, ctx: RouteCtx) {
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) return denied;

  const { jobId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    return Response.json({ ok: false, error: "Invalid job id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const spaceId = url.searchParams.get("spaceId")?.trim() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(spaceId)) {
    return Response.json(
      { ok: false, error: "Query parameter spaceId (uuid) is required" },
      { status: 400 },
    );
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 },
    );
  }

  const [job] = await db
    .select()
    .from(loreImportJobs)
    .where(eq(loreImportJobs.id, jobId))
    .limit(1);

  if (!job || job.spaceId !== spaceId) {
    return Response.json({ ok: false, error: "Job not found" }, { status: 404 });
  }
  if (!(await gmMayAccessSpaceIdAsync(db, bootCtx, spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }

  if (job.status === "processing" && job.updatedAt) {
    const staleBefore = new Date(Date.now() - STALE_LORE_IMPORT_PROCESSING_MS);
    if (job.updatedAt < staleBefore) {
      scheduleLoreImportJobProcessing(jobId);
    }
  }

  if (job.status === "ready" && job.plan) {
    const parsed = loreImportPlanSchema.safeParse(job.plan);
    if (!parsed.success) {
      return Response.json(
        {
          ok: false,
          status: "failed",
          error: "Stored plan failed validation",
        },
        { status: 500 },
      );
    }
    return Response.json({
      ok: true,
      status: job.status,
      plan: parsed.data,
    });
  }

  if (job.status === "ready" && !job.plan) {
    return Response.json(
      {
        ok: false,
        status: "failed",
        error: "Job is ready but plan data is missing",
      },
      { status: 500 },
    );
  }

  if (job.status === "failed" && job.error) {
    console.error("[lore import job failed]", job.id, job.error);
  }

  return Response.json({
    ok: true,
    status: job.status,
    ...(job.status === "failed"
      ? {
          error: "Import job failed",
          code: "lore_import_job_failed",
        }
      : {}),
  });
}
