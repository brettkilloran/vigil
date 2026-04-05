import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import { loreQueryRateLimitExceeded } from "@/src/lib/lore-query-rate-limit";
import { retrieveLoreSources, synthesizeLoreAnswer } from "@/src/lib/lore-engine";
import { assertSpaceExists } from "@/src/lib/spaces";

const bodySchema = z.object({
  question: z.string().min(1).max(4000),
  spaceId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(24).optional(),
});

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if ((process.env.HEARTGARDEN_LORE_QUERY_DISABLED ?? "").trim() === "1") {
    return Response.json(
      {
        ok: false,
        error: "Lore query is disabled on this deployment (HEARTGARDEN_LORE_QUERY_DISABLED).",
        answer: null,
        sources: [],
      },
      { status: 503 },
    );
  }

  if (loreQueryRateLimitExceeded(req)) {
    return Response.json(
      {
        ok: false,
        error: "Too many lore requests. Try again in a minute.",
        answer: null,
        sources: [],
      },
      { status: 429 },
    );
  }

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

  let sources: Awaited<ReturnType<typeof retrieveLoreSources>>;
  try {
    if (spaceId) {
      const space = await assertSpaceExists(db, spaceId);
      if (!space) {
        return Response.json(
          { ok: false, error: "Space not found", answer: null, sources: [] },
          { status: 404 },
        );
      }
    }
    sources = await retrieveLoreSources(db, question, { spaceId, limit });
  } catch (err) {
    console.error("[lore/query] retrieval", err);
    return Response.json(
      {
        ok: false,
        error: "Lore retrieval failed (check database and search configuration).",
        answer: null,
        sources: [],
      },
      { status: 500 },
    );
  }

  if (sources.length === 0) {
    return Response.json({
      ok: true,
      answer:
        "No canvas items matched that question (lexical + semantic if configured). Try different wording, index notes (OPENAI_API_KEY + POST /api/items/:id/index), or add content to the space.",
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
