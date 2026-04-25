import { after } from "next/server";

import { tryGetDb } from "@/src/db/index";

function vaultReindexAfterPatchDisabled(): boolean {
  const v = (process.env.HEARTGARDEN_INDEX_AFTER_PATCH ?? "").trim().toLowerCase();
  return v === "0" || v === "false" || v === "no" || v === "off";
}

/**
 * Run vault reindex after the HTTP response (Next.js `after`) when content or lore meta changes.
 * **Default: enabled.** Set `HEARTGARDEN_INDEX_AFTER_PATCH=0` to disable (e.g. tests or custom pipelines).
 *
 * Uses **`refreshLoreMeta: false`** so this path only rebuilds chunks/embeddings from the row already
 * in Postgres (including existing `lore_summary` / aliases). That avoids duplicate **Anthropic** calls:
 * the shell’s debounced `POST /api/items/:id/index` still defaults to lore-meta refresh when you want it.
 * For zero Anthropic on all index routes, set **`HEARTGARDEN_INDEX_SKIP_LORE_META=1`**.
 */
export function scheduleVaultReindexAfterResponse(itemId: string): void {
  if (vaultReindexAfterPatchDisabled()) return;
  after(async () => {
    const db = tryGetDb();
    if (!db) return;
    const { reindexItemVault } = await import("@/src/lib/item-vault-index");
    await reindexItemVault(db, itemId, { refreshLoreMeta: false }).catch((e) => {
      console.error("[after() vault reindex]", itemId, e);
    });
  });
}
