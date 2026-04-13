import { spaces } from "@/src/db/schema";
import { publishHeartgardenRealtimeEvent, type HeartgardenRealtimeEvent } from "@/src/lib/heartgarden-realtime-publisher";
import { collectSpaceAncestorIdsInclusive, type VigilDb } from "@/src/lib/spaces";

async function readSpaceTreeRows(db: VigilDb): Promise<{ id: string; parentSpaceId: string | null }[]> {
  return db
    .select({ id: spaces.id, parentSpaceId: spaces.parentSpaceId })
    .from(spaces);
}

async function collectFanoutSpaceIds(
  db: VigilDb,
  lookupSpaceIds: readonly string[],
  directSpaceIds: readonly string[],
): Promise<string[]> {
  const out = new Set<string>(directSpaceIds.filter(Boolean));
  if (lookupSpaceIds.length === 0) return [...out];
  const rows = await readSpaceTreeRows(db);
  for (const id of lookupSpaceIds) {
    for (const ancestorId of collectSpaceAncestorIdsInclusive(id, rows)) {
      out.add(ancestorId);
    }
  }
  return [...out];
}

export async function publishHeartgardenSpaceInvalidation(
  db: VigilDb,
  options: {
    originSpaceId: string;
    reason: HeartgardenRealtimeEvent["reason"];
    itemId?: string;
    lookupSpaceIds?: readonly string[];
    directSpaceIds?: readonly string[];
  },
): Promise<void> {
  const lookupSpaceIds = options.lookupSpaceIds ?? [options.originSpaceId];
  const directSpaceIds = options.directSpaceIds ?? [];
  const spaceIds = await collectFanoutSpaceIds(db, lookupSpaceIds, directSpaceIds);
  if (spaceIds.length === 0) return;
  await publishHeartgardenRealtimeEvent({
    type: "space.invalidate",
    spaceId: options.originSpaceId,
    originSpaceId: options.originSpaceId,
    reason: options.reason,
    ...(options.itemId ? { itemId: options.itemId } : {}),
    spaceIds,
    updatedAt: new Date().toISOString(),
  });
}
