/**
 * Soft archive / recoverable hide for items — stored under `items.entity_meta.hgArchive`.
 * Canvas bootstrap uses {@link listItemsForSpaceSubtree} which omits archived rows by default.
 */

export const HG_ARCHIVE_META_KEY = "hgArchive" as const;

export interface HgArchiveMeta {
  archived?: boolean;
  archivedAt?: string;
}

export function readHgArchive(meta: unknown): HgArchiveMeta | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return null;
  }
  const raw = (meta as Record<string, unknown>)[HG_ARCHIVE_META_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const archived = o.archived === true;
  const archivedAt =
    typeof o.archivedAt === "string" ? o.archivedAt : undefined;
  if (!archived && archivedAt === undefined) {
    return null;
  }
  return { archived, ...(archivedAt ? { archivedAt } : {}) };
}

export function isItemArchivedFromEntityMeta(meta: unknown): boolean {
  return readHgArchive(meta)?.archived === true;
}

/** Payload for `PATCH /api/items/:id` with `entityMetaMerge`. */
export function hgArchiveEntityMetaMerge(
  archived: boolean
): Record<string, unknown> {
  return {
    [HG_ARCHIVE_META_KEY]: {
      archived,
      archivedAt: archived ? new Date().toISOString() : null,
    },
  };
}
