import { randomUUID } from "crypto";

import { loreImportJobs } from "@/src/db/schema";
import type { LoreImportPlan, LoreImportUserContext } from "@/src/lib/lore-import-plan-types";
import type { VigilDb } from "@/src/lib/spaces";

/**
 * After synchronous `/api/lore/import/plan` completes, persist a `lore_import_jobs` row so
 * `/api/lore/import/apply` can load server scope metadata (`userContext`) for the batch.
 */
export async function insertLoreImportJobForCompletedSyncPlan(args: {
  db: VigilDb;
  spaceId: string;
  importBatchId: string;
  sourceText: string;
  fileName?: string;
  userContext: LoreImportUserContext | undefined;
  plan: LoreImportPlan;
}): Promise<void> {
  const now = new Date();
  const id = randomUUID();
  const userContextRecord =
    args.userContext != null
      ? (args.userContext as unknown as Record<string, unknown>)
      : null;

  await args.db.insert(loreImportJobs).values({
    id,
    spaceId: args.spaceId,
    importBatchId: args.importBatchId,
    status: "ready",
    sourceText: args.sourceText,
    fileName: args.fileName ?? null,
    userContext: userContextRecord,
    plan: args.plan as unknown as Record<string, unknown>,
    error: null,
    createdAt: now,
    updatedAt: now,
  });
}
