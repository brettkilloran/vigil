import { and, eq, gt, inArray, lte } from "drizzle-orm";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { canvasPresence } from "@/src/db/schema";
import { getHeartgardenApiBootContext } from "@/src/lib/heartgarden-api-boot-context";
import { heartgardenBootClientIp } from "@/src/lib/heartgarden-boot-rate-limit";
import { HEARTGARDEN_PRESENCE_TTL_MS } from "@/src/lib/heartgarden-collab-constants";
import {
  clampPresenceCamera,
  normalizePresenceDisplayName,
  presencePostBodySchema,
  safePresenceCameraFromUnknown,
  safePresencePointerFromUnknown,
  safePresenceSigilFromUnknown,
} from "@/src/lib/heartgarden-presence-body";
import { consumeHeartgardenPresencePostRateLimit } from "@/src/lib/heartgarden-presence-rate-limit";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";
import { fetchDescendantSpaceIds } from "@/src/lib/heartgarden-space-subtree";

async function deleteStalePresenceRows(
  db: NonNullable<ReturnType<typeof tryGetDb>>
) {
  const staleCutoff = new Date(Date.now() - HEARTGARDEN_PRESENCE_TTL_MS);
  await db
    .delete(canvasPresence)
    .where(lte(canvasPresence.updatedAt, staleCutoff));
}

/**
 * Presence GC is opportunistic; avoid scanning on every request.
 */
const PRESENCE_GC_MIN_INTERVAL_MS = 15_000;
let lastPresenceGcAtMs = 0;

function shouldRunPresenceGc(nowMs = Date.now()): boolean {
  if (nowMs - lastPresenceGcAtMs < PRESENCE_GC_MIN_INTERVAL_MS) {
    return false;
  }
  lastPresenceGcAtMs = nowMs;
  return true;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ spaceId: string }> }
) {
  if (process.env.PLAYWRIGHT_E2E === "1") {
    return Response.json({
      ok: true,
      peers: [] as {
        clientId: string;
        activeSpaceId: string;
        camera: { x: number; y: number; zoom: number };
        pointer: { x: number; y: number } | null;
        displayName: string | null;
        sigil: string | null;
        updatedAt: string;
      }[],
    });
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { error: "Database not configured", ok: false },
      { status: 503 }
    );
  }

  const bootCtx = await getHeartgardenApiBootContext();
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) {
    return access.response;
  }

  if (shouldRunPresenceGc()) {
    await deleteStalePresenceRows(db);
  }

  const url = new URL(req.url);
  const selfId = url.searchParams.get("except")?.trim() ?? "";
  const scopeRaw = url.searchParams.get("scope")?.trim().toLowerCase() ?? "";
  const subtreeDefault = scopeRaw !== "local";

  const allowedSpaceIds = subtreeDefault
    ? await fetchDescendantSpaceIds(db, spaceId)
    : new Set([spaceId]);
  const playerAllowedSpaceIds =
    bootCtx.role === "player"
      ? await fetchDescendantSpaceIds(db, bootCtx.playerSpaceId)
      : null;
  const selfIdIsUuid =
    selfId.length > 0 && z.string().uuid().safeParse(selfId).success;

  const cutoff = new Date(Date.now() - HEARTGARDEN_PRESENCE_TTL_MS);
  const rows = await db
    .select({
      activeSpaceId: canvasPresence.activeSpaceId,
      camera: canvasPresence.camera,
      clientId: canvasPresence.clientId,
      displayName: canvasPresence.displayName,
      pointer: canvasPresence.pointer,
      sigil: canvasPresence.sigil,
      updatedAt: canvasPresence.updatedAt,
    })
    .from(canvasPresence)
    .where(
      and(
        inArray(canvasPresence.activeSpaceId, [...allowedSpaceIds]),
        gt(canvasPresence.updatedAt, cutoff)
      )
    );

  const out: {
    clientId: string;
    activeSpaceId: string;
    camera: { x: number; y: number; zoom: number };
    pointer: { x: number; y: number } | null;
    displayName: string | null;
    sigil: string | null;
    updatedAt: string;
  }[] = [];

  for (const r of rows) {
    if (selfIdIsUuid && r.clientId === selfId) {
      continue;
    }
    if (
      bootCtx.role === "player" &&
      !playerAllowedSpaceIds?.has(r.activeSpaceId)
    ) {
      continue;
    }
    const cam = safePresenceCameraFromUnknown(r.camera);
    const ptr = safePresencePointerFromUnknown(r.pointer);
    const name = normalizePresenceDisplayName(r.displayName);
    const sigil = safePresenceSigilFromUnknown(r.sigil);
    out.push({
      activeSpaceId: r.activeSpaceId,
      camera: cam,
      clientId: r.clientId,
      displayName: name,
      pointer: ptr,
      sigil,
      updatedAt: r.updatedAt.toISOString(),
    });
  }

  return Response.json({ ok: true, peers: out });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ spaceId: string }> }
) {
  if (process.env.PLAYWRIGHT_E2E === "1") {
    return Response.json({ ok: true });
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { error: "Database not configured", ok: false },
      { status: 503 }
    );
  }

  const bootCtx = await getHeartgardenApiBootContext();
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) {
    return access.response;
  }

  if (!consumeHeartgardenPresencePostRateLimit(heartgardenBootClientIp(req))) {
    return Response.json({ error: "Rate limited", ok: false }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON", ok: false }, { status: 400 });
  }

  const parsed = presencePostBodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.flatten(), ok: false },
      { status: 400 }
    );
  }

  const camera = clampPresenceCamera(parsed.data.camera);
  const pointer = parsed.data.pointer ?? null;
  const displayName = normalizePresenceDisplayName(parsed.data.displayName);
  const sigil = safePresenceSigilFromUnknown(parsed.data.sigil);

  const now = new Date();
  await db
    .insert(canvasPresence)
    .values({
      activeSpaceId: spaceId,
      camera,
      clientId: parsed.data.clientId,
      displayName,
      pointer,
      sigil,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        activeSpaceId: spaceId,
        camera,
        displayName,
        pointer,
        sigil,
        updatedAt: now,
      },
      target: canvasPresence.clientId,
    });

  if (shouldRunPresenceGc()) {
    await deleteStalePresenceRows(db);
  }

  return Response.json({ ok: true });
}

/**
 * Remove a client's presence row immediately — fired from `pagehide` so a closed tab does not
 * linger as a ghost peer for up to TTL (see `HEARTGARDEN_PRESENCE_TTL_MS`). Only takes
 * `clientId` as a query param because browser keepalive senders prefer short, body-less URLs.
 *
 * Safety rails layered on top of `clientId` ownership (we have no per-user auth):
 * - Requires boot access to the URL `spaceId` just like POST/GET.
 * - Reuses the presence POST rate-limit bucket so a misbehaving or malicious tab cannot spam
 *   deletes; tab-close traffic is tiny (one request per close) so sharing the POST quota is
 *   fine. See `HEARTGARDEN_PRESENCE_POST_RATE_LIMIT_*` in `docs/VERCEL_ENV_VARS.md`.
 * - For **player**-tier callers, only deletes the row when its `active_space_id` sits inside
 *   the player's allowed subtree. This blocks a player session from nuking a GM's presence
 *   row by passing a foreign `clientId`. We scope to the *player's* subtree rather than the
 *   URL `spaceId`'s subtree so that a legitimate "switched from A to B then closed tab" race
 *   (where the beacon URL is B but the row's `active_space_id` is still A) still succeeds
 *   as long as both A and B are inside the player's world. **GM**-tier callers have full
 *   tree access, so no extra scope is applied — matches the existing GM access model.
 */
export async function DELETE(
  req: Request,
  context: { params: Promise<{ spaceId: string }> }
) {
  if (process.env.PLAYWRIGHT_E2E === "1") {
    return Response.json({ ok: true });
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { error: "Database not configured", ok: false },
      { status: 503 }
    );
  }

  const bootCtx = await getHeartgardenApiBootContext();
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) {
    return access.response;
  }

  if (!consumeHeartgardenPresencePostRateLimit(heartgardenBootClientIp(req))) {
    return Response.json({ error: "Rate limited", ok: false }, { status: 429 });
  }

  const url = new URL(req.url);
  const clientIdRaw = url.searchParams.get("clientId")?.trim() ?? "";
  const parsed = z.string().uuid().safeParse(clientIdRaw);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid clientId", ok: false },
      { status: 400 }
    );
  }

  const clientIdMatch = eq(canvasPresence.clientId, parsed.data);
  const whereClause =
    bootCtx.role === "player"
      ? and(
          clientIdMatch,
          inArray(canvasPresence.activeSpaceId, [
            ...(await fetchDescendantSpaceIds(db, bootCtx.playerSpaceId)),
          ])
        )
      : clientIdMatch;

  await db.delete(canvasPresence).where(whereClause);

  if (shouldRunPresenceGc()) {
    await deleteStalePresenceRows(db);
  }

  return Response.json({ ok: true });
}
