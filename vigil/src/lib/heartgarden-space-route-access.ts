import type { tryGetDb } from "@/src/db/index";
import type { HeartgardenApiBootContext } from "@/src/lib/heartgarden-api-boot-context";
import {
  gmMayAccessSpaceId,
  heartgardenApiForbiddenJsonResponse,
  heartgardenMaskNotFoundForPlayer,
  isHeartgardenPlayerBlocked,
  playerMayAccessSpaceId,
} from "@/src/lib/heartgarden-api-boot-context";
import { assertSpaceExists } from "@/src/lib/spaces";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

export type HeartgardenSpaceRouteSpaceRow = NonNullable<Awaited<ReturnType<typeof assertSpaceExists>>>;

/**
 * Authorize Heartgarden boot context for a space-scoped API route (GM / Players / demo rules).
 * Call after `tryGetDb` and `getHeartgardenApiBootContext`.
 *
 * Collab / maintainer docs may refer to this as **`assertHeartgardenSpaceRouteAccess`** — same function.
 */
export async function requireHeartgardenSpaceApiAccess(
  db: VigilDb,
  bootCtx: HeartgardenApiBootContext,
  spaceId: string,
): Promise<{ ok: true; space: HeartgardenSpaceRouteSpaceRow } | { ok: false; response: Response }> {
  if (isHeartgardenPlayerBlocked(bootCtx)) {
    return { ok: false, response: heartgardenApiForbiddenJsonResponse() };
  }

  const space = await assertSpaceExists(db, spaceId);
  if (!space) {
    return {
      ok: false,
      response: heartgardenMaskNotFoundForPlayer(
        bootCtx,
        Response.json({ ok: false, error: "Space not found" }, { status: 404 }),
      ),
    };
  }

  if (!playerMayAccessSpaceId(bootCtx, spaceId)) {
    return { ok: false, response: heartgardenApiForbiddenJsonResponse() };
  }
  if (bootCtx.role === "gm" && !gmMayAccessSpaceId(bootCtx, spaceId)) {
    return { ok: false, response: heartgardenApiForbiddenJsonResponse() };
  }

  return { ok: true, space };
}

/** Alias for search / older plans; identical to {@link requireHeartgardenSpaceApiAccess}. */
export const assertHeartgardenSpaceRouteAccess = requireHeartgardenSpaceApiAccess;
