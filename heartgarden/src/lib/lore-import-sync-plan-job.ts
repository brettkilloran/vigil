import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";

import { loreImportJobs } from "@/src/db/schema";
import {
  isLoreImportJobSchemaLagError,
  readLoreImportJobInsertError,
} from "@/src/lib/lore-import-job-db-insert-helpers";
import type {
  LoreImportPlan,
  LoreImportUserContext,
} from "@/src/lib/lore-import-plan-types";
import type { VigilDb } from "@/src/lib/spaces";

const SYNC_READY_STATUS = "ready" as const;

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
    args.userContext == null
      ? null
      : (args.userContext as unknown as Record<string, unknown>);

  try {
    await args.db.insert(loreImportJobs).values({
      id,
      spaceId: args.spaceId,
      importBatchId: args.importBatchId,
      status: SYNC_READY_STATUS,
      sourceText: args.sourceText,
      fileName: args.fileName ?? null,
      userContext: userContextRecord,
      plan: args.plan as unknown as Record<string, unknown>,
      error: null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    const diag = readLoreImportJobInsertError(error);
    if (!isLoreImportJobSchemaLagError(diag)) {
      throw error;
    }
    const planJson = JSON.stringify(args.plan);
    try {
      await args.db.execute(sql`
        insert into "lore_import_jobs" (
          "id",
          "space_id",
          "import_batch_id",
          "status",
          "source_text",
          "file_name",
          "plan",
          "error",
          "created_at",
          "updated_at"
        ) values (
          ${id},
          ${args.spaceId},
          ${args.importBatchId},
          ${SYNC_READY_STATUS},
          ${args.sourceText},
          ${args.fileName ?? null},
          ${planJson}::jsonb,
          ${null},
          ${now},
          ${now}
        )
      `);
    } catch (legacyError) {
      console.error("[lore-import] sync plan job legacy insert failed", {
        importBatchId: args.importBatchId,
        firstError: diag.message,
        legacyError: readLoreImportJobInsertError(legacyError),
      });
      throw error;
    }
  }
}
