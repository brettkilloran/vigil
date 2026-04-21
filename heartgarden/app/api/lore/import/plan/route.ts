import { randomUUID } from "crypto";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
  heartgardenApiForbiddenJsonResponse,
} from "@/src/lib/heartgarden-api-boot-context";
import { buildLoreImportPlan } from "@/src/lib/lore-import-plan-build";
import { persistImportReviewQueueFromPlan } from "@/src/lib/lore-import-persist-review";
import { assertSpaceExists } from "@/src/lib/spaces";

export const runtime = "nodejs";

export const maxDuration = 300;

const bodySchema = z.object({
  text: z.string().min(1).max(500_000),
  spaceId: z.string().uuid(),
  fileName: z.string().max(512).optional(),
  importBatchId: z.string().uuid().optional(),
  persistReview: z.boolean().optional(),
});

export async function POST(req: Request) {
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) return denied;

  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    return Response.json(
      { ok: false, error: "ANTHROPIC_API_KEY is not configured" },
      { status: 503 },
    );
  }

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
  if (!(await gmMayAccessSpaceIdAsync(db, bootCtx, parsed.data.spaceId))) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const importBatchId = parsed.data.importBatchId ?? randomUUID();
  const model =
    process.env.ANTHROPIC_LORE_MODEL?.trim() || "claude-sonnet-4-20250514";

  try {
    const plan = await buildLoreImportPlan({
      db,
      apiKey: key,
      model,
      fullText: parsed.data.text,
      importBatchId,
      fileName: parsed.data.fileName,
    });

    const persistReview = parsed.data.persistReview !== false;
    await persistImportReviewQueueFromPlan(
      db,
      parsed.data.spaceId,
      plan,
      persistReview,
    );

    return Response.json({ ok: true, plan });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Plan failed";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
