import { and, eq, gt, lte } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { spacePresence } from "@/src/db/schema";
import { getHeartgardenApiBootContext } from "@/src/lib/heartgarden-api-boot-context";
import { HEARTGARDEN_PRESENCE_TTL_MS } from "@/src/lib/heartgarden-collab-constants";
import { heartgardenBootClientIp } from "@/src/lib/heartgarden-boot-rate-limit";
import { consumeHeartgardenPresencePostRateLimit } from "@/src/lib/heartgarden-presence-rate-limit";
import { requireHeartgardenSpaceApiAccess } from "@/src/lib/heartgarden-space-route-access";
import { z } from "zod";

const postBody = z.object({
  clientId: z.string().uuid(),
});

async function deleteStalePresenceForSpace(
  db: NonNullable<ReturnType<typeof tryGetDb>>,
  spaceId: string,
) {
  const staleCutoff = new Date(Date.now() - HEARTGARDEN_PRESENCE_TTL_MS);
  await db
    .delete(spacePresence)
    .where(and(eq(spacePresence.spaceId, spaceId), lte(spacePresence.updatedAt, staleCutoff)));
}

export async function GET(
  req: Request,
  context: { params: Promise<{ spaceId: string }> },
) {
  if (process.env.PLAYWRIGHT_E2E === "1") {
    return Response.json({ ok: true, peers: [] as { clientId: string }[] });
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }

  const bootCtx = await getHeartgardenApiBootContext();
  const { spaceId } = await context.params;
  const access = await requireHeartgardenSpaceApiAccess(db, bootCtx, spaceId);
  if (!access.ok) return access.response;

  await deleteStalePresenceForSpace(db, spaceId);

  const url = new URL(req.url);
  const selfId = url.searchParams.get("except")?.trim() ?? "";

  const cutoff = new Date(Date.now() - HEARTGARDEN_PRESENCE_TTL_MS);
  const rows = await db
    .select({ clientId: spacePresence.clientId })
    .from(spacePresence)
    .where(and(eq(spacePresence.spaceId, spaceId), gt(spacePresence.updatedAt, cutoff)));

  const peers =
    selfId && z.string().uuid().safeParse(selfId).success
      ? rows.filter((r) => r.clientId !== selfId)
      : rows;

  return Response.json({ ok: true, peers });
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

  const parsed = postBody.safeParse(json);
  if (!parsed.success) {
    return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date();
  await db
    .insert(spacePresence)
    .values({
      spaceId,
      clientId: parsed.data.clientId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [spacePresence.spaceId, spacePresence.clientId],
      set: { updatedAt: now },
    });

  await deleteStalePresenceForSpace(db, spaceId);

  return Response.json({ ok: true });
}
