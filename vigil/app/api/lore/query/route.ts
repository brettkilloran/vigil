import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { assertSpaceExists } from "@/src/lib/spaces";
import { retrieveLoreSources, synthesizeLoreAnswer } from "@/src/lib/lore-engine";

const bodySchema = z.object({
  question: z.string().min(1).max(4000),
  spaceId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(24).optional(),
});

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { ok: false, error: "ANTHROPIC_API_KEY not set", answer: null, sources: [] },
      { status: 503 },
    );
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "Database not configured", answer: null, sources: [] },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON", answer: null, sources: [] }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.flatten(), answer: null, sources: [] },
      { status: 400 },
    );
  }

  const { question, spaceId, limit } = parsed.data;

  if (spaceId) {
    const space = await assertSpaceExists(db, spaceId);
    if (!space) {
      return Response.json(
        { ok: false, error: "Space not found", answer: null, sources: [] },
        { status: 404 },
      );
    }
  }

  const sources = await retrieveLoreSources(db, question, { spaceId, limit });

  if (sources.length === 0) {
    return Response.json({
      ok: true,
      answer:
        "No canvas items matched that question in search. Try different keywords, widen your question, or add notes to the space.",
      sources: [],
      model: null,
    });
  }

  const model = (process.env.ANTHROPIC_LORE_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;

  try {
    const answer = await synthesizeLoreAnswer(apiKey, model, question, sources);
    return Response.json({
      ok: true,
      answer,
      sources,
      model,
    });
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Lore synthesis failed (check ANTHROPIC_LORE_MODEL and API access)",
        answer: null,
        sources,
      },
      { status: 502 },
    );
  }
}
