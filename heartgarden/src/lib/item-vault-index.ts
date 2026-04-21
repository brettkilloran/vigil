import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { itemEmbeddings, items } from "@/src/db/schema";
import { embedTexts, isEmbeddingApiConfigured } from "@/src/lib/embedding-provider";
import { extractLoreItemMeta, normalizeLoreMetaInputText } from "@/src/lib/lore-item-meta";
import {
  buildItemVaultCorpus,
  itemSearchableSourceFromRow,
} from "@/src/lib/item-searchable-text";
import { chunkVaultText } from "@/src/lib/vault-chunk";

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

/**
 * Plain-text payload sent to Anthropic for lore summary + aliases (must stay in sync with `extractLoreItemMeta`).
 * Exported for tests and diagnostics only.
 */
export function buildLoreMetaAnthropicBody(row: Pick<ItemRow, "title" | "contentText">): string {
  const titleTrim = row.title?.trim();
  const textTrim = row.contentText?.trim();
  const parts: string[] = [];
  if (titleTrim) parts.push(`Title: ${titleTrim}`);
  if (textTrim) parts.push(textTrim);
  return parts.join("\n\n");
}

/** SHA-256 hex of the exact note text sent to Anthropic (after trim + length cap). */
export function computeLoreMetaSourceHash(row: Pick<ItemRow, "title" | "contentText">): string {
  const forApi = normalizeLoreMetaInputText(buildLoreMetaAnthropicBody(row));
  return sha256Hex(forApi);
}

/** When set, always call Anthropic for lore meta even if the source hash matches (e.g. after changing `ANTHROPIC_LORE_MODEL`). */
function loreMetaIgnoreSourceHashEnv(): boolean {
  const v = (process.env.HEARTGARDEN_LORE_META_IGNORE_SOURCE_HASH ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
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
  let loreSummaryEff = row.loreSummary;
  let loreAliasesEff = row.loreAliases;
  let loreMetaSourceHash: string | undefined;
  const wantMeta = resolveRefreshLoreMeta(options.refreshLoreMeta);
  const anthropicKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (wantMeta && anthropicKey) {
    const body = buildLoreMetaAnthropicBody(row);
    const sourceHash = computeLoreMetaSourceHash(row);
    const skipAnthropic =
      !loreMetaIgnoreSourceHashEnv() &&
      row.loreMetaSourceHash != null &&
      row.loreMetaSourceHash === sourceHash;

    if (!skipAnthropic) {
      const model =
        (process.env.ANTHROPIC_LORE_MODEL ?? DEFAULT_LORE_MODEL).trim() || DEFAULT_LORE_MODEL;
      const meta = await extractLoreItemMeta(anthropicKey, model, body);
      loreSummaryEff = meta.summary || null;
      loreAliasesEff = meta.aliases.length ? meta.aliases : null;
      loreMetaSourceHash = sourceHash;
      loreMetaUpdated = true;
    }
  }

  const corpus = buildItemVaultCorpus(
    itemSearchableSourceFromRow({
      ...row,
      loreSummary: loreSummaryEff,
      loreAliases: loreAliasesEff,
    }),
  );

  if (loreMetaUpdated) {
    await db
      .update(items)
      .set({
        searchBlob: corpus,
        loreSummary: loreSummaryEff,
        loreAliases: loreAliasesEff,
        loreIndexedAt: new Date(),
        loreMetaSourceHash: loreMetaSourceHash!,
      })
      .where(eq(items.id, itemId));
  } else {
    await db.update(items).set({ searchBlob: corpus }).where(eq(items.id, itemId));
  }

  const chunks = chunkVaultText(corpus);
  if (chunks.length === 0) {
    await clearItemEmbeddings(db, itemId);
    return { ok: true, chunks: 0, loreMetaUpdated };
  }

  const vectors = await embedTexts(chunks);
  await clearItemEmbeddings(db, itemId);

  const sourceUpdatedAt = row.updatedAt ?? new Date();
  const values = chunks.map((chunkText, i) => ({
    itemId: row.id,
    spaceId: row.spaceId,
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
