import { cookies } from "next/headers";
import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import {
  getHeartgardenApiBootContext,
  heartgardenApiForbiddenJsonResponse,
  isHeartgardenPlayerBlocked,
} from "@/src/lib/heartgarden-api-boot-context";
import {
  heartgardenRealtimePublicUrlFromEnv,
  isHeartgardenRealtimeConfigured,
} from "@/src/lib/heartgarden-realtime-config";
import { signHeartgardenRealtimeRoomToken } from "@/src/lib/heartgarden-realtime-token";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";

const bodySchema = z.object({
  spaceId: z.string().uuid(),
});

export async function POST(req: Request) {
  if (!isHeartgardenRealtimeConfigured()) {
    return Response.json(
      { error: "Realtime not configured", ok: false },
      { status: 503 }
    );
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { error: "Database not configured", ok: false },
      { status: 503 }
    );
  }

  const bootCtx = await getHeartgardenApiBootContext();
  if (isHeartgardenPlayerBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON", ok: false }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.flatten(), ok: false },
      { status: 400 }
    );
  }

  const access = await requireHeartgardenSpaceApiAccess(
    db,
    bootCtx,
    parsed.data.spaceId
  );
  if (!access.ok) {
    return access.response;
  }

  const jar = await cookies();
  const hasBootCookie = jar.get("hg_boot")?.value;
  if (bootCtx.role !== "gm" && !hasBootCookie) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const exp = Math.floor(Date.now() / 1000) + 60 * 15;
  const token = signHeartgardenRealtimeRoomToken({
    exp,
    role: bootCtx.role === "gm" ? "gm" : "player",
    spaceId: parsed.data.spaceId,
  });

  return Response.json({
    expiresAt: new Date(exp * 1000).toISOString(),
    ok: true,
    realtimeUrl: heartgardenRealtimePublicUrlFromEnv(),
    token,
  });
}
