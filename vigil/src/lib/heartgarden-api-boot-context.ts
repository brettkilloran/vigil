import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { tryGetDb } from "@/src/db/index";
import {
  HEARTGARDEN_BOOT_COOKIE_NAME,
  isPlaywrightE2E,
  readBootEnv,
  verifyBootSessionCookie,
} from "@/src/lib/heartgarden-boot-session";
import { assertSpaceExists } from "@/src/lib/spaces";
import { parseSpaceIdParam } from "@/src/lib/space-id";

/** Stable JSON for visitor / invalid-session denials (no hints). */
export const HEARTGARDEN_API_FORBIDDEN = { ok: false, error: "Forbidden." } as const;

export type HeartgardenApiBootContext =
  | { role: "gm" }
  | { role: "visitor"; playerSpaceId: string }
  | { role: "visitor_forbidden" }
  /** Boot gate on and `hg_boot` cookie present but signature/tamper invalid. */
  | { role: "session_invalid" };

type CookieJar = { get: (name: string) => { value?: string } | undefined };

/**
 * Resolve boot tier for API routes. GM path when gate off, E2E, pre-PIN (no cookie), or valid access cookie.
 * Visitor path only with valid visitor cookie + valid `HEARTGARDEN_PLAYER_SPACE_ID` env.
 */
export function parseHeartgardenApiBootContext(jar: CookieJar): HeartgardenApiBootContext {
  const { gateEnabled, sessionSecret } = readBootEnv();
  if (!gateEnabled || isPlaywrightE2E()) return { role: "gm" };

  const raw = jar.get(HEARTGARDEN_BOOT_COOKIE_NAME)?.value;
  if (!raw) return { role: "gm" };

  const payload = verifyBootSessionCookie(sessionSecret, raw);
  if (!payload) return { role: "session_invalid" };

  if (payload.tier === "access") return { role: "gm" };

  const playerSpaceId = parseSpaceIdParam((process.env.HEARTGARDEN_PLAYER_SPACE_ID ?? "").trim() || null);
  if (!playerSpaceId) return { role: "visitor_forbidden" };

  return { role: "visitor", playerSpaceId };
}

export function heartgardenApiForbiddenResponse(): NextResponse {
  return NextResponse.json(HEARTGARDEN_API_FORBIDDEN, { status: 403 });
}

export function heartgardenApiForbiddenJsonResponse(): Response {
  return Response.json(HEARTGARDEN_API_FORBIDDEN, { status: 403 });
}

export function isHeartgardenVisitorBlocked(ctx: HeartgardenApiBootContext): boolean {
  return ctx.role === "visitor_forbidden" || ctx.role === "session_invalid";
}

/** Visitor may only touch items in exactly this space (Option A — no child spaces in player layer). */
export function visitorMayAccessItemSpace(ctx: HeartgardenApiBootContext, itemSpaceId: string): boolean {
  if (ctx.role !== "visitor") return true;
  return itemSpaceId === ctx.playerSpaceId;
}

/** Visitor cannot move items to another space. */
export function visitorMayApplySpaceIdPatch(
  ctx: HeartgardenApiBootContext,
  existingSpaceId: string,
  nextSpaceId: string | undefined,
): boolean {
  if (ctx.role !== "visitor") return true;
  if (nextSpaceId === undefined) return true;
  return nextSpaceId === existingSpaceId && nextSpaceId === ctx.playerSpaceId;
}

export async function assertPlayerSpaceRowExists(
  db: NonNullable<ReturnType<typeof tryGetDb>>,
  playerSpaceId: string,
): Promise<boolean> {
  const row = await assertSpaceExists(db, playerSpaceId);
  return Boolean(row);
}

export function visitorMayAccessSpaceId(ctx: HeartgardenApiBootContext, spaceId: string): boolean {
  if (ctx.role !== "visitor") return true;
  return spaceId === ctx.playerSpaceId;
}

/** Use at the top of Route Handlers that support the player layer. */
export async function getHeartgardenApiBootContext(): Promise<HeartgardenApiBootContext> {
  const jar = await cookies();
  return parseHeartgardenApiBootContext(jar);
}

/** Lore, vault index, upload, reindex, semantic search, etc. — no player-tier access. */
export function enforceGmOnlyBootContext(ctx: HeartgardenApiBootContext): Response | null {
  if (isHeartgardenVisitorBlocked(ctx)) return heartgardenApiForbiddenJsonResponse();
  if (ctx.role === "visitor") return heartgardenApiForbiddenJsonResponse();
  return null;
}

/**
 * Visitor: return constant 403 instead of 404 for missing resources so clients cannot distinguish
 * “invalid id” vs “exists elsewhere”. GM sessions keep normal 404 responses.
 */
export function heartgardenMaskNotFoundForVisitor(
  ctx: HeartgardenApiBootContext,
  notFoundResponse: Response,
): Response {
  if (ctx.role === "visitor") return heartgardenApiForbiddenJsonResponse();
  return notFoundResponse;
}
