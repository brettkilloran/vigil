import { after } from "next/server";

import { tryGetDb } from "@/src/db/index";
import { reindexItemVault } from "@/src/lib/item-vault-index";

function vaultReindexAfterPatchDisabled(): boolean {
  const v = (process.env.HEARTGARDEN_INDEX_AFTER_PATCH ?? "").trim().toLowerCase();
  return v === "0" || v === "false" || v === "no" || v === "off";
}

/**
 * Run vault reindex after the HTTP response (Next.js `after`) when content or lore meta changes.
 * **Default: enabled.** Set `HEARTGARDEN_INDEX_AFTER_PATCH=0` to disable (e.g. tests or custom pipelines).
 * Complements the debounced client `POST /api/items/:id/index`; both may run if the client also schedules.
 */
export function scheduleVaultReindexAfterResponse(itemId: string): void {
  if (vaultReindexAfterPatchDisabled()) return;
  after(async () => {
    const db = tryGetDb();
    if (!db) return;
    await reindexItemVault(db, itemId, {}).catch(() => {
      /* best-effort */
    });
  });
}
