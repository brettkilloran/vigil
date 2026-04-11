import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { tryGetDb } from "@/src/db/index";
import {
  HEARTGARDEN_BOOT_COOKIE_NAME,
  readBootEnv,
  verifyBootSessionCookie,
} from "@/src/lib/heartgarden-boot-session";
import { isHeartgardenImplicitPlayerRootSpaceName } from "@/src/lib/heartgarden-implicit-player-space";
import {
  isHeartgardenPlayerLayerMisconfigured,
  resolveHeartgardenPlayerSpaceIdFromEnv,
} from "@/src/lib/heartgarden-player-layer-env";
import {
  assertSpaceExists,
  resolveOrCreateImplicitPlayerRootSpace,
} from "@/src/lib/spaces";
import { isHeartgardenGmPlayerSpaceBreakGlassEnabled } from "@/src/lib/heartgarden-gm-break-glass";
import { spaceIsUnderPlayerRoot } from "@/src/lib/heartgarden-space-subtree";
import { authorizationBearerMatchesMcpServiceKey } from "@/src/lib/heartgarden-mcp-service-key";
import { parseSpaceIdParam } from "@/src/lib/space-id";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

/** Stable JSON for player / invalid-session denials (no hints). */
export const HEARTGARDEN_API_FORBIDDEN = { ok: false, error: "Forbidden." } as const;

export type HeartgardenApiBootContext =
  | { role: "gm" }
  | { role: "player"; playerSpaceId: string }
  | { role: "demo" }
  | { role: "player_forbidden" }
  /**
   * Player cookie + no explicit env space id — resolve to Neon default workspace in
   * {@link getHeartgardenApiBootContext} before handling data routes.
   */
  | { role: "player_resolve_from_db" }
  | { role: "session_invalid" }
  /** Boot gate on and no `hg_boot` cookie (middleware should block `/api/*` first). */
  | { role: "unauthenticated" };

type CookieJar = { get: (name: string) => { value?: string } | undefined };

/** Neon space UUID hidden from GM workspace when set (Players-only space). */
export function heartgardenPlayerSpaceIdExcludedFromGm(): string | undefined {
  return parseSpaceIdParam((process.env.HEARTGARDEN_PLAYER_SPACE_ID ?? "").trim() || null);
}

export function gmMayAccessSpaceId(ctx: HeartgardenApiBootContext, spaceId: string): boolean {
  if (ctx.role !== "gm") return true;
  const hid = heartgardenPlayerSpaceIdExcludedFromGm();
  if (!hid) return true;
  if (spaceId === hid && isHeartgardenGmPlayerSpaceBreakGlassEnabled()) return true;
  return spaceId !== hid;
}

export function gmMayAccessItemSpace(ctx: HeartgardenApiBootContext, itemSpaceId: string): boolean {
  return gmMayAccessSpaceId(ctx, itemSpaceId);
}

/**
 * GM cannot access the implicit Players-only root space (or items in it) even when
 * `HEARTGARDEN_PLAYER_SPACE_ID` is unset.
 */
export async function gmMayAccessSpaceIdAsync(
  db: VigilDb,
  ctx: HeartgardenApiBootContext,
  spaceId: string,
): Promise<boolean> {
  if (!gmMayAccessSpaceId(ctx, spaceId)) return false;
  if (ctx.role !== "gm") return true;
  const row = await assertSpaceExists(db, spaceId);
  if (!row) return false;
  return !isHeartgardenImplicitPlayerRootSpaceName(row.name);
}

export async function gmMayAccessItemSpaceAsync(
  db: VigilDb,
  ctx: HeartgardenApiBootContext,
  itemSpaceId: string,
): Promise<boolean> {
  return gmMayAccessSpaceIdAsync(db, ctx, itemSpaceId);
}

/**
 * Resolve boot tier for API routes. GM path when gate off, E2E, or valid Bishop (`access`) cookie.
 * Player path with valid player cookie: env UUID if set, else {@link player_resolve_from_db} for
 * async resolution against Neon (see {@link getHeartgardenApiBootContext}).
 */
export function parseHeartgardenApiBootContext(jar: CookieJar): HeartgardenApiBootContext {
  const { gateEnabled, sessionSecret } = readBootEnv();
  if (!gateEnabled) return { role: "gm" };

  const raw = jar.get(HEARTGARDEN_BOOT_COOKIE_NAME)?.value;
  if (!raw) return { role: "unauthenticated" };

  const payload = verifyBootSessionCookie(sessionSecret, raw);
  if (!payload) return { role: "session_invalid" };

  if (payload.tier === "access") return { role: "gm" };
  if (payload.tier === "demo") return { role: "demo" };

  if (isHeartgardenPlayerLayerMisconfigured()) return { role: "player_forbidden" };

  const playerSpaceId = resolveHeartgardenPlayerSpaceIdFromEnv();
  if (playerSpaceId) return { role: "player", playerSpaceId };
  return { role: "player_resolve_from_db" };
}

export function heartgardenApiForbiddenResponse(): NextResponse {
  return NextResponse.json(HEARTGARDEN_API_FORBIDDEN, { status: 403 });
}

export function heartgardenApiForbiddenJsonResponse(): Response {
  return Response.json(HEARTGARDEN_API_FORBIDDEN, { status: 403 });
}

export function isHeartgardenPlayerBlocked(ctx: HeartgardenApiBootContext): boolean {
  return (
    ctx.role === "player_forbidden" ||
    ctx.role === "player_resolve_from_db" ||
    ctx.role === "session_invalid" ||
    ctx.role === "unauthenticated" ||
    ctx.role === "demo"
  );
}

/** GM or Players — sessions that may call Neon-backed item/space APIs. */
export function isHeartgardenNeonDataSession(ctx: HeartgardenApiBootContext): boolean {
  return ctx.role === "gm" || ctx.role === "player";
}

/**
 * Players may touch items in the assigned **root** space or any **folder** space under it.
 * Prefer {@link playerMayAccessItemSpaceAsync} in route handlers (DB-backed subtree check).
 */
export function playerMayAccessItemSpace(ctx: HeartgardenApiBootContext, itemSpaceId: string): boolean {
  if (ctx.role !== "player") return true;
  return itemSpaceId === ctx.playerSpaceId;
}

export async function playerMayAccessItemSpaceAsync(
  db: NonNullable<ReturnType<typeof tryGetDb>>,
  ctx: HeartgardenApiBootContext,
  itemSpaceId: string,
): Promise<boolean> {
  if (ctx.role !== "player") return true;
  return spaceIsUnderPlayerRoot(db, ctx.playerSpaceId, itemSpaceId);
}

/** Players cannot move items outside their player-root subtree. */
export function playerMayApplySpaceIdPatch(
  ctx: HeartgardenApiBootContext,
  existingSpaceId: string,
  nextSpaceId: string | undefined,
): boolean {
  if (ctx.role !== "player") return true;
  if (nextSpaceId === undefined) return true;
  return nextSpaceId === existingSpaceId && nextSpaceId === ctx.playerSpaceId;
}

export async function playerMayApplySpaceIdPatchAsync(
  db: NonNullable<ReturnType<typeof tryGetDb>>,
  ctx: HeartgardenApiBootContext,
  existingSpaceId: string,
  nextSpaceId: string | undefined,
): Promise<boolean> {
  if (ctx.role !== "player") return true;
  if (nextSpaceId === undefined) return true;
  const root = ctx.playerSpaceId;
  return (
    (await spaceIsUnderPlayerRoot(db, root, existingSpaceId)) &&
    (await spaceIsUnderPlayerRoot(db, root, nextSpaceId))
  );
}

export async function assertPlayerSpaceRowExists(
  db: NonNullable<ReturnType<typeof tryGetDb>>,
  playerSpaceId: string,
): Promise<boolean> {
  const row = await assertSpaceExists(db, playerSpaceId);
  return Boolean(row);
}

/** Prefer {@link playerMayAccessSpaceIdAsync} in async routes. */
export function playerMayAccessSpaceId(ctx: HeartgardenApiBootContext, spaceId: string): boolean {
  if (ctx.role !== "player") return true;
  return spaceId === ctx.playerSpaceId;
}

export async function playerMayAccessSpaceIdAsync(
  db: NonNullable<ReturnType<typeof tryGetDb>>,
  ctx: HeartgardenApiBootContext,
  spaceId: string,
): Promise<boolean> {
  if (ctx.role !== "player") return true;
  return spaceIsUnderPlayerRoot(db, ctx.playerSpaceId, spaceId);
}

/** Use at the top of Route Handlers that support the player layer. */
export async function getHeartgardenApiBootContext(): Promise<HeartgardenApiBootContext> {
  const h = await headers();
  if (authorizationBearerMatchesMcpServiceKey(h.get("authorization"))) {
    return { role: "gm" };
  }

  const jar = await cookies();
  const ctx = parseHeartgardenApiBootContext(jar);
  if (ctx.role !== "player_resolve_from_db") return ctx;
  const db = tryGetDb();
  if (!db) return { role: "player_forbidden" };
  const row = await resolveOrCreateImplicitPlayerRootSpace(db);
  return { role: "player", playerSpaceId: row.id };
}

/** Lore, vault index, upload, reindex, semantic search, etc. — no player-tier or demo access. */
export function enforceGmOnlyBootContext(ctx: HeartgardenApiBootContext): Response | null {
  if (ctx.role !== "gm") return heartgardenApiForbiddenJsonResponse();
  return null;
}

/**
 * Players: return constant 403 instead of 404 for missing resources so clients cannot distinguish
 * “invalid id” vs “exists elsewhere”. GM sessions keep normal 404 responses.
 */
export function heartgardenMaskNotFoundForPlayer(
  ctx: HeartgardenApiBootContext,
  notFoundResponse: Response,
): Response {
  if (ctx.role === "player") return heartgardenApiForbiddenJsonResponse();
  return notFoundResponse;
}
