import type { tryGetDb } from "@/src/db/index";
import type { HeartgardenApiBootContext } from "@/src/lib/heartgarden-api-boot-context";
import {
  heartgardenApiForbiddenJsonResponse,
  isHeartgardenPlayerBlocked,
} from "@/src/lib/heartgarden-api-boot-context";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

/**
 * Same JSON envelope as existing `app/api/**` routes when Postgres is unavailable.
 */
export function heartgardenApiRequireDb(
  db: ReturnType<typeof tryGetDb>
): { ok: true; db: VigilDb } | { ok: false; response: Response } {
  if (!db) {
    return {
      ok: false,
      response: Response.json(
        { ok: false, error: "Database not configured" },
        { status: 503 }
      ),
    };
  }
  return { ok: true, db };
}

export function heartgardenApiRejectIfPlayerBlocked(
  bootCtx: HeartgardenApiBootContext
): Response | null {
  if (isHeartgardenPlayerBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  return null;
}

/**
 * Read JSON body; **400** `Invalid JSON` matches existing route handlers.
 */
export async function heartgardenApiReadJsonBody(
  req: Request
): Promise<{ ok: true; json: unknown } | { ok: false; response: Response }> {
  try {
    const json = await req.json();
    return { ok: true, json };
  } catch {
    return {
      ok: false,
      response: Response.json(
        { ok: false, error: "Invalid JSON" },
        { status: 400 }
      ),
    };
  }
}
