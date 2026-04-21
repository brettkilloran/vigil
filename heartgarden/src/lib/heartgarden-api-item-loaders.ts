import { eq } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { items } from "@/src/db/schema";
import type { HeartgardenApiBootContext } from "@/src/lib/heartgarden-api-boot-context";
import {
  gmMayAccessItemSpaceAsync,
  gmMayAccessSpaceIdAsync,
  playerMayAccessItemSpaceAsync,
  playerMayAccessSpaceIdAsync,
} from "@/src/lib/heartgarden-api-boot-context";
import { assertSpaceExists } from "@/src/lib/spaces";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

export type ItemRow = typeof items.$inferSelect;

/**
 * Load one item row with the same access checks as read-only item APIs (`/api/v1/items/:id`, etc.).
 */
export type LoadItemRowForHeartgardenApiResult =
  | { kind: "ok"; row: ItemRow }
  | { kind: "absent" }
  | { kind: "deny" };

export async function loadItemRowForHeartgardenApi(
  db: VigilDb,
  bootCtx: HeartgardenApiBootContext,
  itemId: string,
): Promise<LoadItemRowForHeartgardenApiResult> {
  const [row] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!row) return { kind: "absent" };
  if (!(await playerMayAccessItemSpaceAsync(db, bootCtx, row.spaceId))) return { kind: "deny" };
  if (!(await gmMayAccessItemSpaceAsync(db, bootCtx, row.spaceId))) return { kind: "deny" };
  return { kind: "ok", row };
}

export type V1ItemsListSpaceAccessResult =
  | { kind: "ok"; space: NonNullable<Awaited<ReturnType<typeof assertSpaceExists>>> }
  | { kind: "space_absent" }
  | { kind: "deny" };

/**
 * Space gate for `GET /api/v1/items` (legacy error shapes — callers map `space_absent` by role).
 */
export async function assertV1ItemsListSpaceAccess(
  db: VigilDb,
  bootCtx: HeartgardenApiBootContext,
  spaceId: string,
): Promise<V1ItemsListSpaceAccessResult> {
  const space = await assertSpaceExists(db, spaceId);
  if (!space) return { kind: "space_absent" };
  if (!(await playerMayAccessSpaceIdAsync(db, bootCtx, spaceId))) return { kind: "deny" };
  if (!(await gmMayAccessSpaceIdAsync(db, bootCtx, spaceId))) return { kind: "deny" };
  return { kind: "ok", space };
}
