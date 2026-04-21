import { eq } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import { FACTION_ROSTER_HG_ARCH_KEY } from "@/src/lib/faction-roster-schema";
import type { FactionRosterEntry } from "@/src/lib/faction-roster-schema";
import { parseFactionRoster } from "@/src/lib/faction-roster-schema";
import type { LoreThreadAnchorsShape } from "@/src/lib/hg-arch-binding-projection";
import { buildSearchBlob } from "@/src/lib/search-blob";
import { isUuidLike } from "@/src/lib/uuid-like";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

type JsonRecord = Record<string, unknown>;

function demoteRosterRowForDeletedCharacter(row: FactionRosterEntry, deadId: string): FactionRosterEntry {
  if (row.kind !== "character" || row.characterItemId !== deadId) return row;
  return {
    id: row.id,
    kind: "unlinked",
    label: row.displayNameOverride?.trim() || "Former member",
    ...(row.roleOverride?.trim() ? { role: row.roleOverride } : {}),
  };
}

function scrubAnchors(a: LoreThreadAnchorsShape | undefined, deadId: string): LoreThreadAnchorsShape | undefined {
  if (!a) return undefined;
  let next: LoreThreadAnchorsShape = { ...a };
  let touched = false;
  if (next.primaryLocationItemId === deadId) {
    next = { ...next, primaryLocationItemId: undefined };
    touched = true;
  }
  if (next.primaryFactionItemId === deadId) {
    next = { ...next, primaryFactionItemId: undefined, primaryFactionRosterEntryId: undefined };
    touched = true;
  }
  const linked = next.linkedCharacterItemIds?.filter((id) => id !== deadId);
  if (linked && linked.length !== (next.linkedCharacterItemIds?.length ?? 0)) {
    next = { ...next, linkedCharacterItemIds: linked.length ? linked : undefined };
    touched = true;
  }
  return touched ? next : a;
}

function scrubIdArray(raw: unknown, deadId: string): { next: unknown; changed: boolean } {
  if (!Array.isArray(raw)) return { next: raw, changed: false };
  let changed = false;
  const next = raw.filter((x) => {
    if (typeof x === "string") {
      if (x === deadId) {
        changed = true;
        return false;
      }
      return true;
    }
    if (x && typeof x === "object" && "itemId" in x) {
      const id = (x as { itemId?: unknown }).itemId;
      if (typeof id === "string" && id === deadId) {
        changed = true;
        return false;
      }
    }
    return true;
  });
  return { next, changed };
}

/**
 * Remove references to `deadItemId` from `content_json.hgArch` (best-effort, in-memory).
 * Returns null if nothing changed.
 */
export function stripHgArchReferencesToItem(
  contentJson: unknown,
  deadItemId: string,
): Record<string, unknown> | null {
  if (!contentJson || typeof contentJson !== "object" || Array.isArray(contentJson)) return null;
  const root = contentJson as JsonRecord;
  const hgRaw = root.hgArch;
  if (!hgRaw || typeof hgRaw !== "object" || Array.isArray(hgRaw)) return null;

  const hg = { ...(hgRaw as JsonRecord) };
  let changed = false;

  const roster = parseFactionRoster(hg[FACTION_ROSTER_HG_ARCH_KEY]);
  if (roster) {
    let rosterChanged = false;
    const nextRoster = roster.map((r) => {
      const n = demoteRosterRowForDeletedCharacter(r, deadItemId);
      if (n !== r) rosterChanged = true;
      return n;
    });
    if (rosterChanged) {
      hg[FACTION_ROSTER_HG_ARCH_KEY] = nextRoster;
      changed = true;
    }
  }

  const anchorsRaw = hg.loreThreadAnchors;
  if (anchorsRaw && typeof anchorsRaw === "object" && !Array.isArray(anchorsRaw)) {
    const scrubbed = scrubAnchors(anchorsRaw as LoreThreadAnchorsShape, deadItemId);
    if (scrubbed !== anchorsRaw) {
      const empty =
        !scrubbed?.primaryLocationItemId &&
        !scrubbed?.primaryFactionItemId &&
        !scrubbed?.primaryFactionRosterEntryId &&
        !(scrubbed?.linkedCharacterItemIds?.length ?? 0);
      if (empty) {
        delete hg.loreThreadAnchors;
      } else {
        hg.loreThreadAnchors = scrubbed;
      }
      changed = true;
    }
  }

  for (const key of ["primaryFactions", "primaryLocations"] as const) {
    const { next, changed: c } = scrubIdArray(hg[key], deadItemId);
    if (c) {
      hg[key] = next;
      changed = true;
    }
  }

  if (!changed) return null;
  return { ...root, hgArch: hg };
}

/** True if `text` mentions a UUID equal to `deadId` (cheap pre-filter before JSON parse). */
export function contentJsonMightReferenceItemId(contentJson: unknown, deadId: string): boolean {
  if (!isUuidLike(deadId)) return false;
  try {
    const s = JSON.stringify(contentJson);
    return s.includes(deadId);
  } catch {
    return true;
  }
}

/** Strip hgArch pointers to a deleted item for every other row in the same space. Returns updated item ids. */
export async function scrubHgArchRefsAfterItemDelete(
  db: VigilDb,
  opts: { spaceId: string; deadItemId: string },
): Promise<string[]> {
  const updatedIds: string[] = [];
  const rows = await db.select().from(items).where(eq(items.spaceId, opts.spaceId));
  for (const row of rows) {
    if (row.id === opts.deadItemId) continue;
    if (!contentJsonMightReferenceItemId(row.contentJson, opts.deadItemId)) continue;
    const nextJson = stripHgArchReferencesToItem(row.contentJson, opts.deadItemId);
    if (!nextJson) continue;
    const searchBlob = buildSearchBlob({
      title: row.title,
      contentText: row.contentText,
      contentJson: nextJson,
      entityType: row.entityType,
      entityMeta: row.entityMeta,
      imageUrl: row.imageUrl,
      imageMeta: row.imageMeta,
      loreSummary: row.loreSummary,
      loreAliases: row.loreAliases ?? undefined,
    });
    await db
      .update(items)
      .set({ contentJson: nextJson, searchBlob, updatedAt: new Date() })
      .where(eq(items.id, row.id));
    updatedIds.push(row.id);
  }
  return updatedIds;
}
