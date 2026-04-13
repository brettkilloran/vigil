import { and, eq } from "drizzle-orm";

import { importReviewItems } from "@/src/db/schema";
import type { LoreImportPlan } from "@/src/lib/lore-import-plan-types";
import type { VigilDb } from "@/src/lib/spaces";

/**
 * Writes contradiction + required-clarification rows and replaces prior pending rows for this batch.
 */
export async function persistImportReviewQueueFromPlan(
  db: VigilDb,
  spaceId: string,
  plan: LoreImportPlan,
  persistReview: boolean,
): Promise<void> {
  if (!persistReview) return;
  const now = new Date();
  const rows: (typeof importReviewItems.$inferInsert)[] = [];
  for (const c of plan.contradictions) {
    rows.push({
      importBatchId: plan.importBatchId,
      spaceId,
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
      spaceId,
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
  await db.transaction(async (tx) => {
    await tx
      .delete(importReviewItems)
      .where(
        and(
          eq(importReviewItems.spaceId, spaceId),
          eq(importReviewItems.importBatchId, plan.importBatchId),
          eq(importReviewItems.status, "pending"),
        ),
      );
    if (rows.length > 0) {
      await tx.insert(importReviewItems).values(rows);
    }
  });
}
