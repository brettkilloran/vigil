import { and, eq } from "drizzle-orm";

import { importReviewItems } from "@/src/db/schema";
import type { LoreImportPlan } from "@/src/lib/lore-import-plan-types";
import type { VigilDb } from "@/src/lib/spaces";

/**
 * Replaces pending import-review queue rows for this batch (delete + insert).
 * Call inside a `db.transaction` (or a single connection) for atomicity with other work.
 */
export async function replaceImportReviewQueueForPlan(
  db: VigilDb,
  spaceId: string,
  plan: LoreImportPlan
): Promise<void> {
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
    if (cl.severity !== "required") {
      continue;
    }
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
  await db
    .delete(importReviewItems)
    .where(
      and(
        eq(importReviewItems.spaceId, spaceId),
        eq(importReviewItems.importBatchId, plan.importBatchId),
        eq(importReviewItems.status, "pending")
      )
    );
  if (rows.length > 0) {
    await db.insert(importReviewItems).values(rows);
  }
}

/**
 * Writes contradiction + required-clarification rows and replaces prior pending rows for this batch.
 */
export async function persistImportReviewQueueFromPlan(
  db: VigilDb,
  spaceId: string,
  plan: LoreImportPlan,
  persistReview: boolean
): Promise<void> {
  if (!persistReview) {
    return;
  }
  await db.transaction(async (tx) => {
    await replaceImportReviewQueueForPlan(
      tx as unknown as VigilDb,
      spaceId,
      plan
    );
  });
}
