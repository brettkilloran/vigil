import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
} from "@/src/lib/heartgarden-api-boot-context";
import { runLoreConsistencyCheck } from "@/src/lib/lore-consistency-check";
import { assertSpaceExists } from "@/src/lib/spaces";

export const runtime = "nodejs";

const bodySchema = z.object({
  bodyText: z.string().min(1).max(120_000),
  excludeItemId: z.string().uuid().optional(),
  spaceId: z.string().uuid(),
  title: z.string().max(255).default(""),
});

export async function POST(req: Request) {
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) {
    return denied;
  }

  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured", ok: false },
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

  if (!(await gmMayAccessSpaceIdAsync(db, bootCtx, parsed.data.spaceId))) {
    return Response.json({ error: "Forbidden.", ok: false }, { status: 403 });
  }

  const space = await assertSpaceExists(db, parsed.data.spaceId);
  if (!space) {
    return Response.json(
      { error: "Space not found", ok: false },
      { status: 404 }
    );
  }

  const model =
    process.env.ANTHROPIC_LORE_MODEL?.trim() || "claude-sonnet-4-20250514";

  try {
    const result = await runLoreConsistencyCheck({
      apiKey: key,
      bodyText: parsed.data.bodyText,
      db,
      excludeItemId: parsed.data.excludeItemId,
      model,
      spaceId: parsed.data.spaceId,
      title: parsed.data.title,
    });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Consistency check failed";
    return Response.json({ error: msg, ok: false }, { status: 500 });
  }
}
