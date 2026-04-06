import { and, eq, gt } from "drizzle-orm";

import { tryGetDb } from "@/src/db/index";
import { spacePresence } from "@/src/db/schema";
import {
  getHeartgardenApiBootContext,
  gmMayAccessSpaceId,
  heartgardenApiForbiddenJsonResponse,
  heartgardenMaskNotFoundForVisitor,
  isHeartgardenVisitorBlocked,
  visitorMayAccessSpaceId,
} from "@/src/lib/heartgarden-api-boot-context";
import { assertSpaceExists } from "@/src/lib/spaces";
import { z } from "zod";

const PRESENCE_TTL_MS = 120_000;

const postBody = z.object({
  clientId: z.string().uuid(),
});

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
  if (isHeartgardenVisitorBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const { spaceId } = await context.params;
  const space = await assertSpaceExists(db, spaceId);
  if (!space) {
    return heartgardenMaskNotFoundForVisitor(
      bootCtx,
      Response.json({ ok: false, error: "Space not found" }, { status: 404 }),
    );
  }
  if (!visitorMayAccessSpaceId(bootCtx, spaceId)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  if (bootCtx.role === "gm" && !gmMayAccessSpaceId(bootCtx, spaceId)) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const url = new URL(req.url);
  const selfId = url.searchParams.get("except")?.trim() ?? "";

  const cutoff = new Date(Date.now() - PRESENCE_TTL_MS);
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
  if (isHeartgardenVisitorBlocked(bootCtx)) {
    return heartgardenApiForbiddenJsonResponse();
  }

  const { spaceId } = await context.params;
  const space = await assertSpaceExists(db, spaceId);
  if (!space) {
    return heartgardenMaskNotFoundForVisitor(
      bootCtx,
      Response.json({ ok: false, error: "Space not found" }, { status: 404 }),
    );
  }
  if (!visitorMayAccessSpaceId(bootCtx, spaceId)) {
    return heartgardenApiForbiddenJsonResponse();
  }
  if (bootCtx.role === "gm" && !gmMayAccessSpaceId(bootCtx, spaceId)) {
    return heartgardenApiForbiddenJsonResponse();
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

  await db
    .insert(spacePresence)
    .values({
      spaceId,
      clientId: parsed.data.clientId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [spacePresence.spaceId, spacePresence.clientId],
      set: { updatedAt: new Date() },
    });

  return Response.json({ ok: true });
}
