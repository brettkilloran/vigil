import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { itemEmbeddings, items } from "@/src/db/schema";
import { embedTexts, isEmbeddingApiConfigured } from "@/src/lib/embedding-provider";
import { deriveSectionsFromHgDoc, fallbackSingleSection } from "@/src/lib/hg-doc/derive-sections";
import { isHgDocContentJson, readHgDocFromContentJson } from "@/src/lib/hg-doc/serialize";
import { extractLoreItemMeta, normalizeLoreMetaInputText } from "@/src/lib/lore-item-meta";
import {
  buildItemVaultCorpus,
  itemSearchableSourceFromRow,
} from "@/src/lib/item-searchable-text";
import { chunkVaultSections } from "@/src/lib/vault-chunk";

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

function assertLoreMetaHashInvariant(
  loreMetaUpdated: boolean,
  loreMetaSourceHash: string | undefined,
): string | undefined {
  if (!loreMetaUpdated) return undefined;
  if (typeof loreMetaSourceHash === "string" && loreMetaSourceHash.length > 0) {
    return loreMetaSourceHash;
  }
  throw new Error("lore meta hash invariant violated: update requested without source hash");
}

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
  let requiredLoreMetaHash: string | undefined;
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
      requiredLoreMetaHash = assertLoreMetaHashInvariant(loreMetaUpdated, loreMetaSourceHash);
    }
  }

  const corpus = buildItemVaultCorpus(
    itemSearchableSourceFromRow({
      ...row,
      loreSummary: loreSummaryEff,
      loreAliases: loreAliasesEff,
    }),
  );

  const contentJson = (row.contentJson ?? null) as Record<string, unknown> | null;
  const sections = isHgDocContentJson(contentJson)
    ? deriveSectionsFromHgDoc(readHgDocFromContentJson(contentJson), row.title || "Untitled")
    : fallbackSingleSection(row.contentText ?? corpus, row.title || "Untitled");
  const chunks = chunkVaultSections(sections);

  /** No vector rows: persist lexical row only. */
  if (chunks.length === 0) {
    if (loreMetaUpdated) {
      await db
        .update(items)
        .set({
          searchBlob: corpus,
          loreSummary: loreSummaryEff,
          loreAliases: loreAliasesEff,
          loreIndexedAt: new Date(),
          loreMetaSourceHash: requiredLoreMetaHash,
        })
        .where(eq(items.id, itemId));
    } else {
      await db.update(items).set({ searchBlob: corpus }).where(eq(items.id, itemId));
    }
    await clearItemEmbeddings(db, itemId);
    return { ok: true, chunks: 0, loreMetaUpdated };
  }

  /** Embed first so we never persist a new `search_blob` if embedding fails (audit: vector/index drift). */
  const vectors = await embedTexts(chunks.map((c) => c.chunkText));

  const sourceUpdatedAt = row.updatedAt ?? new Date();
  const values = chunks.map((chunk, i) => ({
    itemId: row.id,
    spaceId: row.spaceId,
    chunkIndex: i,
    contentHash: sha256Hex(chunk.chunkText),
    sourceUpdatedAt,
    embedding: vectors[i]!,
    chunkText: chunk.chunkText,
    headingPath: JSON.stringify(chunk.headingPath),
  }));

  await db.transaction(async (tx) => {
    if (loreMetaUpdated) {
      await tx
        .update(items)
        .set({
          searchBlob: corpus,
          loreSummary: loreSummaryEff,
          loreAliases: loreAliasesEff,
          loreIndexedAt: new Date(),
          loreMetaSourceHash: requiredLoreMetaHash,
        })
        .where(eq(items.id, itemId));
    } else {
      await tx.update(items).set({ searchBlob: corpus }).where(eq(items.id, itemId));
    }
    await tx.delete(itemEmbeddings).where(eq(itemEmbeddings.itemId, itemId));
    await tx.insert(itemEmbeddings).values(values);
  });

  return { ok: true, chunks: chunks.length, loreMetaUpdated };
}

// REVIEW_2026-04-22-2 H6: cap upstream embedding/summary calls with bounded
// concurrency. The previous serial loop walked every item one-at-a-time while
// each reindex issues OpenAI + Anthropic requests, which made medium spaces
// trip request timeouts. A small concurrency cap keeps tail latency bounded
// and respects upstream rate limits without a full job queue rewrite.
const REINDEX_SPACE_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.HEARTGARDEN_REINDEX_CONCURRENCY ?? "", 10) || 4,
);

export async function reindexSpaceVault(
  db: VigilDb,
  spaceId: string,
  options: { refreshLoreMeta?: boolean } = {},
): Promise<{ items: number; errors: number }> {
  const rows = await db.select({ id: items.id }).from(items).where(eq(items.spaceId, spaceId));
  let errors = 0;
  let cursor = 0;
  const total = rows.length;
  async function runWorker(): Promise<void> {
    while (true) {
      const next = cursor++;
      if (next >= total) return;
      const row = rows[next];
      if (!row) return;
      try {
        await reindexItemVault(db, row.id, options);
      } catch {
        errors += 1;
      }
    }
  }
  const workerCount = Math.min(REINDEX_SPACE_CONCURRENCY, Math.max(1, total));
  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i += 1) {
    workers.push(runWorker());
  }
  await Promise.all(workers);
  return { items: total, errors };
}
