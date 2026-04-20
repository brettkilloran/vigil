import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { itemEmbeddings, items } from "@/src/db/schema";
import { embedTexts, isEmbeddingApiConfigured } from "@/src/lib/embedding-provider";
import { extractLoreItemMeta } from "@/src/lib/lore-item-meta";
import { buildHgArchBindingSummaryText } from "@/src/lib/hg-arch-binding-projection";
import { buildSearchBlob } from "@/src/lib/search-blob";
import { buildVaultEmbedDocument, chunkVaultText } from "@/src/lib/vault-chunk";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;
export type ItemRow = typeof items.$inferSelect;

const DEFAULT_LORE_MODEL = "claude-sonnet-4-20250514";

/** When unset, `HEARTGARDEN_INDEX_SKIP_LORE_META=1` skips Anthropic lore fields on index. */
function resolveRefreshLoreMeta(explicit?: boolean): boolean {
  if (explicit === false) return false;
  if (explicit === true) return true;
  const skip = (process.env.HEARTGARDEN_INDEX_SKIP_LORE_META ?? "").trim().toLowerCase();
  if (skip === "1" || skip === "true" || skip === "yes") return false;
  return true;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Remove all embedding chunks for an item (call after content edits until reindexed). */
export async function clearItemEmbeddings(db: VigilDb, itemId: string): Promise<void> {
  await db.delete(itemEmbeddings).where(eq(itemEmbeddings.itemId, itemId));
}

export async function refreshItemEmbedding(db: VigilDb, row: ItemRow): Promise<void> {
  await clearItemEmbeddings(db, row.id);
}

export function scheduleItemEmbeddingRefresh(db: VigilDb, row: ItemRow): void {
  void refreshItemEmbedding(db, row).catch(() => {
    /* best-effort cleanup */
  });
}

export type ReindexItemVaultResult = {
  ok: boolean;
  chunks: number;
  loreMetaUpdated: boolean;
  skipped?: string;
};

/**
 * Chunk, embed, and insert rows for one item. Optionally refresh lore_summary / aliases via Anthropic first.
 */
export async function reindexItemVault(
  db: VigilDb,
  itemId: string,
  options: { refreshLoreMeta?: boolean } = {},
): Promise<ReindexItemVaultResult> {
  const [row] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!row) {
    return { ok: false, chunks: 0, loreMetaUpdated: false, skipped: "not_found" };
  }

  if (!isEmbeddingApiConfigured()) {
    await clearItemEmbeddings(db, itemId);
    return { ok: true, chunks: 0, loreMetaUpdated: false, skipped: "no_embedding_provider" };
  }

  let loreMetaUpdated = false;
  const wantMeta = resolveRefreshLoreMeta(options.refreshLoreMeta);
  const anthropicKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (wantMeta && anthropicKey) {
    const model =
      (process.env.ANTHROPIC_LORE_MODEL ?? DEFAULT_LORE_MODEL).trim() || DEFAULT_LORE_MODEL;
    const body = [row.title?.trim() && `Title: ${row.title}`, row.contentText?.trim()]
      .filter(Boolean)
      .join("\n\n");
    const meta = await extractLoreItemMeta(anthropicKey, model, body);
    const searchBlob = buildSearchBlob({
      title: row.title,
      contentText: row.contentText,
      contentJson: row.contentJson,
      entityType: row.entityType,
      entityMeta: row.entityMeta,
      imageUrl: row.imageUrl,
      imageMeta: row.imageMeta,
      loreSummary: meta.summary || null,
      loreAliases: meta.aliases.length ? meta.aliases : null,
    });
    await db
      .update(items)
      .set({
        loreSummary: meta.summary || null,
        loreAliases: meta.aliases.length ? meta.aliases : null,
        loreIndexedAt: new Date(),
        searchBlob,
      })
      .where(eq(items.id, itemId));
    loreMetaUpdated = true;
  }

  const [latest] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  const r = latest ?? row;

  const bindingProjection = buildHgArchBindingSummaryText(
    r.contentJson as Record<string, unknown> | null | undefined,
  );
  const doc = buildVaultEmbedDocument({
    title: r.title,
    contentText: r.contentText,
    loreSummary: r.loreSummary,
    loreAliases: r.loreAliases ?? undefined,
    bindingProjection: bindingProjection || null,
  });
  const chunks = chunkVaultText(doc);
  if (chunks.length === 0) {
    await clearItemEmbeddings(db, itemId);
    return { ok: true, chunks: 0, loreMetaUpdated };
  }

  const vectors = await embedTexts(chunks);
  await clearItemEmbeddings(db, itemId);

  const sourceUpdatedAt = r.updatedAt ?? new Date();
  const values = chunks.map((chunkText, i) => ({
    itemId: r.id,
    spaceId: r.spaceId,
    chunkIndex: i,
    contentHash: sha256Hex(chunkText),
    sourceUpdatedAt,
    embedding: vectors[i]!,
    chunkText,
  }));

  await db.insert(itemEmbeddings).values(values);

  return { ok: true, chunks: chunks.length, loreMetaUpdated };
}

export async function reindexSpaceVault(
  db: VigilDb,
  spaceId: string,
  options: { refreshLoreMeta?: boolean } = {},
): Promise<{ items: number; errors: number }> {
  const rows = await db.select({ id: items.id }).from(items).where(eq(items.spaceId, spaceId));
  let errors = 0;
  for (const row of rows) {
    try {
      await reindexItemVault(db, row.id, options);
    } catch {
      errors += 1;
    }
  }
  return { items: rows.length, errors };
}
