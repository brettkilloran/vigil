import { and, gt, inArray, lte } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { canvasPresence } from "@/src/db/schema";
import { getHeartgardenApiBootContext } from "@/src/lib/heartgarden-api-boot-context";
import { HEARTGARDEN_PRESENCE_TTL_MS } from "@/src/lib/heartgarden-collab-constants";
import { heartgardenBootClientIp } from "@/src/lib/heartgarden-boot-rate-limit";
import {
  clampPresenceCamera,
  presencePostBodySchema,
  safePresenceCameraFromUnknown,
  safePresencePointerFromUnknown,
} from "@/src/lib/heartgarden-presence-body";
import { consumeHeartgardenPresencePostRateLimit } from "@/src/lib/heartgarden-presence-rate-limit";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";
import {
  fetchDescendantSpaceIds,
} from "@/src/lib/heartgarden-space-subtree";
import { z } from "zod";

async function deleteStalePresenceRows(db: NonNullable<ReturnType<typeof tryGetDb>>) {
  const staleCutoff = new Date(Date.now() - HEARTGARDEN_PRESENCE_TTL_MS);
  await db.delete(canvasPresence).where(lte(canvasPresence.updatedAt, staleCutoff));
}

/**
 * Presence GC is opportunistic; avoid scanning on every request.
 */
const PRESENCE_GC_MIN_INTERVAL_MS = 15_000;
let lastPresenceGcAtMs = 0;

function shouldRunPresenceGc(nowMs = Date.now()): boolean {
  if (nowMs - lastPresenceGcAtMs < PRESENCE_GC_MIN_INTERVAL_MS) return false;
  lastPresenceGcAtMs = nowMs;
  return true;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ spaceId: string }> },
) {
  if (process.env.PLAYWRIGHT_E2E === "1") {
    return Response.json({
      ok: true,
      peers: [] as {
        clientId: string;
        activeSpaceId: string;
        camera: { x: number; y: number; zoom: number };
        pointer: { x: number; y: number } | null;
        updatedAt: string;
      }[],
    });
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }

  const bootCtx = await getHeartgardenApiBootContext();
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) return access.response;

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
    bootCtx.role === "player" ? await fetchDescendantSpaceIds(db, bootCtx.playerSpaceId) : null;
  const selfIdIsUuid = selfId.length > 0 && z.string().uuid().safeParse(selfId).success;

  const cutoff = new Date(Date.now() - HEARTGARDEN_PRESENCE_TTL_MS);
  const rows = await db
    .select({
      clientId: canvasPresence.clientId,
      activeSpaceId: canvasPresence.activeSpaceId,
      camera: canvasPresence.camera,
      pointer: canvasPresence.pointer,
      updatedAt: canvasPresence.updatedAt,
    })
    .from(canvasPresence)
    .where(
      and(inArray(canvasPresence.activeSpaceId, [...allowedSpaceIds]), gt(canvasPresence.updatedAt, cutoff)),
    );

  const out: {
    clientId: string;
    activeSpaceId: string;
    camera: { x: number; y: number; zoom: number };
    pointer: { x: number; y: number } | null;
    updatedAt: string;
  }[] = [];

  for (const r of rows) {
    if (selfIdIsUuid && r.clientId === selfId) continue;
    if (bootCtx.role === "player") {
      if (!playerAllowedSpaceIds?.has(r.activeSpaceId)) continue;
    }
    const cam = safePresenceCameraFromUnknown(r.camera);
    const ptr = safePresencePointerFromUnknown(r.pointer);
    out.push({
      clientId: r.clientId,
      activeSpaceId: r.activeSpaceId,
      camera: cam,
      pointer: ptr,
      updatedAt: r.updatedAt.toISOString(),
    });
  }

  return Response.json({ ok: true, peers: out });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ spaceId: string }> },
) {
  if (process.env.PLAYWRIGHT_E2E === "1") {
    return Response.json({ ok: true });
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }

  const bootCtx = await getHeartgardenApiBootContext();
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) return access.response;

  if (!consumeHeartgardenPresencePostRateLimit(heartgardenBootClientIp(req))) {
    return Response.json({ ok: false, error: "Rate limited" }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = presencePostBodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const camera = clampPresenceCamera(parsed.data.camera);
  const pointer =
    parsed.data.pointer === undefined ? null : parsed.data.pointer === null ? null : parsed.data.pointer;

  const now = new Date();
  await db
    .insert(canvasPresence)
    .values({
      clientId: parsed.data.clientId,
      activeSpaceId: spaceId,
      camera,
      pointer,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: canvasPresence.clientId,
      set: {
        activeSpaceId: spaceId,
        camera,
        pointer,
        updatedAt: now,
      },
    });

  if (shouldRunPresenceGc()) {
    await deleteStalePresenceRows(db);
  }

  return Response.json({ ok: true });
}
