import { eq, sql } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { spaces } from "@/src/db/schema";
import { HEARTGARDEN_IMPLICIT_PLAYER_ROOT_SPACE_NAME } from "@/src/lib/heartgarden-implicit-player-space";
import { resolveHeartgardenPlayerSpaceIdFromEnv } from "@/src/lib/heartgarden-player-layer-env";
import { collectDescendantSpaceIds } from "@/src/lib/heartgarden-space-subtree";

export type SeverPlayerGmWorldsReport = {
  playerRootIdsPreserved: string[];
  playerSpaceIds: string[];
  deletedCrossWorldLinks: number;
  deletedItems: number;
  deletedChildSpaces: number;
  dryRun: boolean;
};

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

function firstCount(result: unknown): number {
  if (!result || typeof result !== "object") {
    return 0;
  }
  const r = result as { rows?: unknown[] };
  const row = r.rows?.[0] as { c?: unknown } | undefined;
  const c = row?.c;
  return typeof c === "number" ? c : Number(c) || 0;
}

function postOrderDeletableSpaces(
  allRows: readonly { id: string; parentSpaceId: string | null }[],
  deletable: Set<string>
): string[] {
  const byId = new Map(allRows.map((r) => [r.id, r]));
  const byParent = new Map<string | null, string[]>();
  for (const r of allRows) {
    const p = r.parentSpaceId ?? null;
    const list = byParent.get(p) ?? [];
    list.push(r.id);
    byParent.set(p, list);
  }
  const out: string[] = [];
  const walk = (id: string) => {
    if (!deletable.has(id)) {
      return;
    }
    for (const k of byParent.get(id) ?? []) {
      walk(k);
    }
    out.push(id);
  };
  for (const id of deletable) {
    const row = byId.get(id);
    const p = row?.parentSpaceId ?? null;
    if (p === null || !deletable.has(p)) {
      walk(id);
    }
  }
  return out;
}

/**
 * Physically separates GM and Players Neon data:
 * 1. Deletes `item_links` whose endpoints span player-world vs GM-world spaces.
 * 2. Deletes all `items` in the player world (implicit root subtree + env player UUID subtree).
 * 3. Deletes child `spaces` under those roots (preserves root rows so config / implicit name keep working).
 *
 * Player world = union of subtrees rooted at every `__heartgarden_player_root__` row and at
 * `resolveHeartgardenPlayerSpaceIdFromEnv()` when that UUID exists in `spaces`.
 */
export async function severHeartgardenPlayerGmWorlds(
  db: VigilDb,
  options?: { dryRun?: boolean }
): Promise<SeverPlayerGmWorldsReport> {
  const dryRun = options?.dryRun === true;

  const allSlim = await db
    .select({ id: spaces.id, parentSpaceId: spaces.parentSpaceId })
    .from(spaces);

  const implicitRows = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(eq(spaces.name, HEARTGARDEN_IMPLICIT_PLAYER_ROOT_SPACE_NAME));

  const roots = new Set<string>();
  for (const r of implicitRows) {
    roots.add(r.id);
  }

  const envRoot = resolveHeartgardenPlayerSpaceIdFromEnv();
  if (envRoot && allSlim.some((s) => s.id === envRoot)) {
    roots.add(envRoot);
  }

  const playerSpaceIds = new Set<string>();
  for (const rootId of roots) {
    for (const id of collectDescendantSpaceIds(rootId, allSlim)) {
      playerSpaceIds.add(id);
    }
  }

  const playerSpaceList = [...playerSpaceIds];
  const rootIdsPreserved = [...roots];

  const emptyReport = (): SeverPlayerGmWorldsReport => ({
    playerRootIdsPreserved: rootIdsPreserved,
    playerSpaceIds: playerSpaceList,
    deletedCrossWorldLinks: 0,
    deletedItems: 0,
    deletedChildSpaces: 0,
    dryRun,
  });

  if (playerSpaceList.length === 0) {
    return emptyReport();
  }

  const uuidArray = sql`ARRAY[${sql.join(
    playerSpaceList.map((id) => sql`${id}`),
    sql`, `
  )}]::uuid[]`;

  const crossSql = sql`
DELETE FROM item_links il
USING items src, items tgt
WHERE il.source_item_id = src.id AND il.target_item_id = tgt.id
AND (
  (src.space_id = ANY(${uuidArray}) AND NOT (tgt.space_id = ANY(${uuidArray})))
  OR
  (NOT (src.space_id = ANY(${uuidArray})) AND tgt.space_id = ANY(${uuidArray}))
)
`;

  const itemsSql = sql`DELETE FROM items WHERE space_id = ANY(${uuidArray})`;

  const deletableSpaceIds = new Set(playerSpaceIds);
  for (const r of roots) {
    deletableSpaceIds.delete(r);
  }
  const deleteSpaceOrder = postOrderDeletableSpaces(allSlim, deletableSpaceIds);

  if (dryRun) {
    const linkCount = await db.execute(sql`
      SELECT count(*)::int AS c FROM item_links il
      JOIN items src ON src.id = il.source_item_id
      JOIN items tgt ON tgt.id = il.target_item_id
      WHERE (src.space_id = ANY(${uuidArray}) AND NOT (tgt.space_id = ANY(${uuidArray})))
         OR (NOT (src.space_id = ANY(${uuidArray})) AND tgt.space_id = ANY(${uuidArray}))
    `);
    const itemCount = await db.execute(sql`
      SELECT count(*)::int AS c FROM items WHERE space_id = ANY(${uuidArray})
    `);
    const lc = firstCount(linkCount);
    const ic = firstCount(itemCount);
    return {
      playerRootIdsPreserved: rootIdsPreserved,
      playerSpaceIds: playerSpaceList,
      deletedCrossWorldLinks: lc,
      deletedItems: ic,
      deletedChildSpaces: deleteSpaceOrder.length,
      dryRun: true,
    };
  }

  const linkRes = await db.execute(crossSql);
  const deletedCrossWorldLinks = Number(linkRes.rowCount ?? 0);

  const itemRes = await db.execute(itemsSql);
  const deletedItems = Number(itemRes.rowCount ?? 0);

  let deletedChildSpaces = 0;
  for (const sid of deleteSpaceOrder) {
    await db.delete(spaces).where(eq(spaces.id, sid));
    deletedChildSpaces += 1;
  }

  return {
    playerRootIdsPreserved: rootIdsPreserved,
    playerSpaceIds: playerSpaceList,
    deletedCrossWorldLinks,
    deletedItems,
    deletedChildSpaces,
    dryRun: false,
  };
}
