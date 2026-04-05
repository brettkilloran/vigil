import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
} from "@/src/lib/heartgarden-api-boot-context";
import { runLoreConsistencyCheck } from "@/src/lib/lore-consistency-check";
import { assertSpaceExists } from "@/src/lib/spaces";

export const runtime = "nodejs";

const bodySchema = z.object({
  spaceId: z.string().uuid(),
  title: z.string().max(255).default(""),
  bodyText: z.string().min(1).max(120_000),
  excludeItemId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) return denied;

  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    return Response.json(
      { ok: false, error: "ANTHROPIC_API_KEY is not configured" },
      { status: 503 },
    );
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured" },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const space = await assertSpaceExists(db, parsed.data.spaceId);
  if (!space) {
    return Response.json({ ok: false, error: "Space not found" }, { status: 404 });
  }

  const model =
    process.env.ANTHROPIC_LORE_MODEL?.trim() || "claude-sonnet-4-20250514";

  try {
    const result = await runLoreConsistencyCheck({
      db,
      apiKey: key,
      model,
      spaceId: parsed.data.spaceId,
      title: parsed.data.title,
      bodyText: parsed.data.bodyText,
      excludeItemId: parsed.data.excludeItemId,
    });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Consistency check failed";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
