import { eq, inArray } from "drizzle-orm";

import { items, spaces } from "@/src/db/schema";
import type { VigilDb } from "@/src/lib/spaces";

interface ValidationError {
  error: string;
  ok: false;
  status: number;
}

interface ValidationSuccess {
  ok: true;
  sourceBraneId: string | null;
  sourceSpaceId: string;
  targetIds: string[];
  targetSpaceIds: string[];
}

export type LinkTargetValidationResult = ValidationError | ValidationSuccess;

export async function validateLinkTargetsInBrane(
  db: VigilDb,
  sourceItemId: string,
  targetItemIds: string[]
): Promise<LinkTargetValidationResult> {
  const [source] = await db
    .select({ braneId: spaces.braneId, id: items.id, spaceId: items.spaceId })
    .from(items)
    .innerJoin(spaces, eq(spaces.id, items.spaceId))
    .where(eq(items.id, sourceItemId))
    .limit(1);
  if (!source) {
    return { error: "Source item not found", ok: false, status: 404 };
  }

  const targetIds = [...new Set(targetItemIds)].filter(
    (id) => id !== sourceItemId
  );
  if (targetIds.length === 0) {
    return {
      ok: true,
      sourceBraneId: source.braneId,
      sourceSpaceId: source.spaceId,
      targetIds: [],
      targetSpaceIds: [],
    };
  }

  const peers = await db
    .select({ braneId: spaces.braneId, id: items.id, spaceId: items.spaceId })
    .from(items)
    .innerJoin(spaces, eq(spaces.id, items.spaceId))
    .where(inArray(items.id, targetIds));

  if (peers.length !== targetIds.length) {
    return {
      error: "One or more target items not found",
      ok: false,
      status: 404,
    };
  }

  if (peers.some((peer) => peer.braneId !== source.braneId)) {
    return {
      error: "Cross-brane links are not allowed",
      ok: false,
      status: 400,
    };
  }

  return {
    ok: true,
    sourceBraneId: source.braneId,
    sourceSpaceId: source.spaceId,
    targetIds,
    targetSpaceIds: peers.map((peer) => peer.spaceId),
  };
}
