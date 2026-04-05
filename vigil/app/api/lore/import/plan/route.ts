import { randomUUID } from "crypto";
import { z } from "zod";

import { and, eq } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { importReviewItems } from "@/src/db/schema";
import { buildLoreImportPlan } from "@/src/lib/lore-import-plan-build";
import { assertSpaceExists } from "@/src/lib/spaces";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().min(1).max(500_000),
  spaceId: z.string().uuid(),
  fileName: z.string().max(512).optional(),
  importBatchId: z.string().uuid().optional(),
  persistReview: z.boolean().optional(),
});

export async function POST(req: Request) {
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
    if (persistReview) {
      const now = new Date();
      const rows: (typeof importReviewItems.$inferInsert)[] = [];
      for (const c of plan.contradictions) {
        rows.push({
          importBatchId: plan.importBatchId,
          spaceId: parsed.data.spaceId,
          status: "pending",
          kind: "contradiction",
          payload: {
            contradictionId: c.id,
            noteClientId: c.noteClientId,
            summary: c.summary,
            details: c.details,
            fileName: plan.fileName,
          },
          createdAt: now,
          updatedAt: now,
        });
      }
      for (const cl of plan.clarifications) {
        if (cl.severity !== "required") continue;
        rows.push({
          importBatchId: plan.importBatchId,
          spaceId: parsed.data.spaceId,
          status: "pending",
          kind: `clarification_${cl.category}`,
          payload: {
            clarificationId: cl.id,
            category: cl.category,
            title: cl.title,
            context: cl.context,
            questionKind: cl.questionKind,
            optionLabels: cl.options.map((o) => ({ id: o.id, label: o.label })),
            fileName: plan.fileName,
          },
          createdAt: now,
          updatedAt: now,
        });
      }
      if (rows.length > 0) {
        await db
          .delete(importReviewItems)
          .where(
            and(
              eq(importReviewItems.spaceId, parsed.data.spaceId),
              eq(importReviewItems.importBatchId, plan.importBatchId),
              eq(importReviewItems.status, "pending"),
            ),
          );
        await db.insert(importReviewItems).values(rows);
      }
    }

    return Response.json({ ok: true, plan });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Plan failed";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
