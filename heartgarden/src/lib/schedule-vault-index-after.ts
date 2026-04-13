import { after } from "next/server";

import { tryGetDb } from "@/src/db/index";
import { reindexItemVault } from "@/src/lib/item-vault-index";

/**
 * When `HEARTGARDEN_INDEX_AFTER_PATCH=1`, run vault reindex after the HTTP response
 * (Next.js `after`). Complements the debounced client `POST /api/items/:id/index`;
 * may duplicate work if both are enabled — disable client scheduling later if you rely on this.
 */
export function scheduleVaultReindexAfterResponse(itemId: string): void {
  if ((process.env.HEARTGARDEN_INDEX_AFTER_PATCH ?? "").trim() !== "1") return;
  after(async () => {
    const db = tryGetDb();
    if (!db) return;
    await reindexItemVault(db, itemId, {}).catch(() => {
      /* best-effort */
    });
  });
}
