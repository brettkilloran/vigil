import { eq, inArray } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { spaces } from "@/src/db/schema";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

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
  const slim = await db
    .select({ id: spaces.id, parentSpaceId: spaces.parentSpaceId })
    .from(spaces);
  const allowedIds = collectDescendantSpaceIds(playerRootSpaceId, slim);
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
