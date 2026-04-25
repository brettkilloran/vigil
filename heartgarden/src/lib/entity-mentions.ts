import { after } from "next/server";

import { eq } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { entityMentions, items, spaces } from "@/src/db/schema";
import { buildEntityVocabularyForBrane, clearEntityVocabularyCache } from "@/src/lib/entity-vocabulary";
import { invalidateItemLinksRevisionForSpace } from "@/src/lib/item-links-space-revision";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countMatches(text: string, term: string): number {
  const re = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
  let count = 0;
  while (re.exec(text) !== null) count += 1;
  return count;
}

function makeSnippet(text: string, term: string): string | null {
  const re = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
  const m = re.exec(text);
  if (!m) return null;
  const idx = m.index;
  const start = Math.max(0, idx - 120);
  const end = Math.min(text.length, idx + term.length + 120);
  return text.slice(start, end).trim();
}

export async function rescanItemEntityMentions(
  db: VigilDb,
  itemId: string,
): Promise<void> {
  const [row] = await db
    .select({
      id: items.id,
      title: items.title,
      searchBlob: items.searchBlob,
      spaceId: items.spaceId,
      braneId: spaces.braneId,
    })
    .from(items)
    .innerJoin(spaces, eq(spaces.id, items.spaceId))
    .where(eq(items.id, itemId))
    .limit(1);
  if (!row?.braneId) return;

  const vocab = await buildEntityVocabularyForBrane(db, row.braneId);
  const blob = row.searchBlob ?? "";
  const previous = await db
    .select({
      id: entityMentions.id,
      targetItemId: entityMentions.targetItemId,
      matchedTerm: entityMentions.matchedTerm,
      sourceKind: entityMentions.sourceKind,
      sourceSpaceId: entityMentions.sourceSpaceId,
    })
    .from(entityMentions)
    .where(eq(entityMentions.sourceItemId, itemId));
  const previousKeyToId = new Map<string, string>(
    previous.map((p) => [`${p.targetItemId}::${p.matchedTerm}::${p.sourceKind}`, p.id]),
  );
  const nextKeys = new Set<string>();
  const touchedSpaceIds = new Set<string>([row.spaceId]);

  for (const entry of vocab.terms) {
    const count = countMatches(blob, entry.term);
    if (count < 1) continue;
    const snippet = makeSnippet(blob, entry.term);
    for (const targetItemId of entry.itemIds) {
      if (targetItemId === itemId) continue;
      const key = `${targetItemId}::${entry.term}::term`;
      nextKeys.add(key);
      const existingId = previousKeyToId.get(key);
      if (existingId) {
        await db
          .update(entityMentions)
          .set({
            mentionCount: count,
            snippet,
            sourceSpaceId: row.spaceId,
            updatedAt: new Date(),
          })
          .where(eq(entityMentions.id, existingId));
      } else {
        await db.insert(entityMentions).values({
          sourceItemId: itemId,
          targetItemId,
          matchedTerm: entry.term,
          mentionCount: count,
          snippet,
          braneId: row.braneId,
          sourceSpaceId: row.spaceId,
          sourceKind: "term",
        });
      }
      const [targetSpace] = await db
        .select({ spaceId: items.spaceId })
        .from(items)
        .where(eq(items.id, targetItemId))
        .limit(1);
      if (targetSpace?.spaceId) touchedSpaceIds.add(targetSpace.spaceId);
    }
  }

  for (const prev of previous) {
    const key = `${prev.targetItemId}::${prev.matchedTerm}::${prev.sourceKind}`;
    if (nextKeys.has(key)) continue;
    await db.delete(entityMentions).where(eq(entityMentions.id, prev.id));
  }

  for (const spaceId of touchedSpaceIds) {
    invalidateItemLinksRevisionForSpace(spaceId);
  }
}

export function scheduleBraneEntityMentionRescanAfterResponse(
  db: VigilDb,
  braneId: string,
): void {
  after(async () => {
    const rows = await db
      .select({ id: items.id })
      .from(items)
      .innerJoin(spaces, eq(spaces.id, items.spaceId))
      .where(eq(spaces.braneId, braneId));
    for (const row of rows) {
      await rescanItemEntityMentions(db, row.id).catch(() => {
        /* best effort */
      });
    }
  });
}

export function scheduleEntityMentionRescanOnVocabularyChange(
  db: VigilDb,
  braneId: string,
): void {
  clearEntityVocabularyCache(braneId);
  scheduleBraneEntityMentionRescanAfterResponse(db, braneId);
}
