import { eq, inArray } from "drizzle-orm";

import { items, spaces } from "@/src/db/schema";
import type { VigilDb } from "@/src/lib/spaces";

type ValidationError = {
  ok: false;
  status: number;
  error: string;
};

type ValidationSuccess = {
  ok: true;
  sourceSpaceId: string;
  sourceBraneId: string | null;
  targetSpaceIds: string[];
  targetIds: string[];
};

export type LinkTargetValidationResult = ValidationError | ValidationSuccess;

export async function validateLinkTargetsInBrane(
  db: VigilDb,
  sourceItemId: string,
  targetItemIds: string[],
): Promise<LinkTargetValidationResult> {
  const [source] = await db
    .select({ id: items.id, spaceId: items.spaceId, braneId: spaces.braneId })
    .from(items)
    .innerJoin(spaces, eq(spaces.id, items.spaceId))
    .where(eq(items.id, sourceItemId))
    .limit(1);
  if (!source) {
    return { ok: false, status: 404, error: "Source item not found" };
  }

  const targetIds = [...new Set(targetItemIds)].filter((id) => id !== sourceItemId);
  if (targetIds.length === 0) {
    return { ok: true, sourceSpaceId: source.spaceId, sourceBraneId: source.braneId, targetSpaceIds: [], targetIds: [] };
  }

  const peers = await db
    .select({ id: items.id, spaceId: items.spaceId, braneId: spaces.braneId })
    .from(items)
    .innerJoin(spaces, eq(spaces.id, items.spaceId))
    .where(inArray(items.id, targetIds));

  if (peers.length !== targetIds.length) {
    return {
      ok: false,
      status: 404,
      error: "One or more target items not found",
    };
  }

  if (peers.some((peer) => peer.braneId !== source.braneId)) {
    return {
      ok: false,
      status: 400,
      error: "Cross-brane links are not allowed",
    };
  }

  return {
    ok: true,
    sourceSpaceId: source.spaceId,
    sourceBraneId: source.braneId,
    targetSpaceIds: peers.map((peer) => peer.spaceId),
    targetIds,
  };
}

export const validateLinkTargetsInSourceSpace = validateLinkTargetsInBrane;
