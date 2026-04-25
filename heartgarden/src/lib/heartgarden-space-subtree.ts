import { eq, inArray, sql } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { spaces } from "@/src/db/schema";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

/**
 * Collect every descendant space id under `rootSpaceId` (inclusive) via a single
 * `WITH RECURSIVE` round-trip. Replaces the prior approach that loaded the full
 * `spaces` table into memory and walked it. Pairs with the
 * `spaces_parent_space_id_idx` index (migration `0019`) so each recursive step
 * is an index lookup. (`REVIEW_2026-04-25_1835` H2.)
 *
 * Defense-in-depth: a broken `parent_space_id` cycle (which the schema does not
 * formally prohibit) would loop forever in the CTE; we cap depth so a corrupt
 * row can never DoS the request thread.
 */
async function fetchSubtreeSpaceIdsViaCte(
  db: VigilDb,
  rootSpaceId: string,
): Promise<Set<string>> {
  const MAX_DEPTH = 256;
  const result = await db.execute(sql`
    WITH RECURSIVE descendants(id, depth) AS (
      SELECT id, 0 AS depth FROM spaces WHERE id = ${rootSpaceId}
      UNION ALL
      SELECT s.id, d.depth + 1
      FROM spaces s
      INNER JOIN descendants d ON s.parent_space_id = d.id
      WHERE d.depth < ${MAX_DEPTH}
    )
    SELECT DISTINCT id FROM descendants
  `);
  const rows = (result as unknown as { rows?: Array<{ id: string }> }).rows
    ?? (Array.isArray(result) ? (result as unknown as Array<{ id: string }>) : []);
  const out = new Set<string>();
  for (const r of rows) {
    if (typeof r?.id === "string") out.add(r.id);
  }
  return out;
}

/**
 * True if `candidateSpaceId` equals `playerRootSpaceId` or is a descendant folder space under it.
 * Used so Players can use child spaces (folders) inside their assigned root without leaving the world.
 */
export async function spaceIsUnderPlayerRoot(
  db: VigilDb,
  playerRootSpaceId: string,
  candidateSpaceId: string,
): Promise<boolean> {
  if (candidateSpaceId === playerRootSpaceId) return true;
  let current: string | null = candidateSpaceId;
  const seen = new Set<string>();
  for (let depth = 0; depth < 256 && current; depth++) {
    if (current === playerRootSpaceId) return true;
    if (seen.has(current)) return false;
    seen.add(current);
    const [row] = await db
      .select({ parentSpaceId: spaces.parentSpaceId })
      .from(spaces)
      .where(eq(spaces.id, current))
      .limit(1);
    if (!row) return false;
    current = row.parentSpaceId ?? null;
  }
  return false;
}

/** All `spaces` rows in the subtree rooted at `playerRootSpaceId` (for bootstrap / change polls). */
export async function fetchPlayerSubtreeSpacesFull(db: VigilDb, playerRootSpaceId: string) {
  // REVIEW_2026-04-25_1835 H2: use a recursive CTE that walks `parent_space_id`
  // from the player root downward instead of loading the entire `spaces` table.
  // At hundreds of folders × dozens of branes the previous full-table SELECT was
  // a per-request hot path (bootstrap, /api/spaces, change-polls).
  const allowedIds = await fetchSubtreeSpaceIdsViaCte(db, playerRootSpaceId);
  if (!allowedIds.has(playerRootSpaceId) || allowedIds.size === 0) return [];
  return await db.select().from(spaces).where(inArray(spaces.id, [...allowedIds]));
}

/** Slim rows for `collectSpaceSubtreeIds` under the player root. */
export async function fetchPlayerSubtreeSpaceRows(
  db: VigilDb,
  playerRootSpaceId: string,
): Promise<{ id: string; parentSpaceId: string | null }[]> {
  const rows = await fetchPlayerSubtreeSpacesFull(db, playerRootSpaceId);
  return rows.map((r) => ({ id: r.id, parentSpaceId: r.parentSpaceId ?? null }));
}

/**
 * Scoped subtree traversal without loading the full spaces table.
 * Uses a `WITH RECURSIVE` CTE so depth `D` becomes one round-trip instead of
 * `D` (`REVIEW_2026-04-25_1835` H2). Pairs with `spaces_parent_space_id_idx`.
 *
 * Defensive note: returns `{rootSpaceId}` even if the root row is missing; that
 * preserves the historical behaviour of the iterative implementation
 * (out was seeded with `rootSpaceId` regardless of DB state).
 */
export async function fetchDescendantSpaceIds(
  db: VigilDb,
  rootSpaceId: string,
): Promise<Set<string>> {
  const ids = await fetchSubtreeSpaceIdsViaCte(db, rootSpaceId);
  if (ids.size === 0) ids.add(rootSpaceId);
  return ids;
}

/** Collect `rootId` and every descendant space id using parent pointers (breadth from DB rows). */
export function collectDescendantSpaceIds(
  rootId: string,
  rows: readonly { id: string; parentSpaceId: string | null }[],
): Set<string> {
  const childrenByParent = new Map<string | null, string[]>();
  for (const r of rows) {
    const pid = r.parentSpaceId ?? null;
    const list = childrenByParent.get(pid);
    if (list) list.push(r.id);
    else childrenByParent.set(pid, [r.id]);
  }
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    const kids = childrenByParent.get(id);
    if (kids) for (const c of kids) stack.push(c);
  }
  return out;
}
