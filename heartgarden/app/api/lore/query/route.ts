import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
} from "@/src/lib/heartgarden-api-boot-context";
import { loreQueryRateLimitExceeded } from "@/src/lib/lore-query-rate-limit";
import {
  retrieveLoreSources,
  synthesizeLoreAnswer,
  synthesizeLoreAnswerGrounded,
  synthesizeLoreAnswerStream,
} from "@/src/lib/lore-engine";
import { finalizeHeartgardenSearchFiltersForDb } from "@/src/lib/heartgarden-search-tier-policy";
import { assertSpaceExists, type SearchFilters } from "@/src/lib/spaces";

const bodySchema = z.object({
  question: z.string().min(1).max(4000),
  spaceId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(24).optional(),
  stream: z.boolean().optional(),
  responseMode: z.enum(["text", "grounded_json"]).optional(),
});

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export const runtime = "nodejs";

function maybeLogLoreQueryMetric(event: string, payload: Record<string, unknown>): void {
  const raw = (process.env.HEARTGARDEN_ANTHROPIC_METRICS_SAMPLE_RATE ?? "").trim();
  const rate = Number(raw);
  if (!Number.isFinite(rate)) return;
  const clamped = Math.max(0, Math.min(1, rate));
  if (Math.random() >= clamped) return;
  try {
    console.info(`[lore-query-metric] ${JSON.stringify({ event, ...payload })}`);
  } catch {
    // no-op
  }
}

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) return denied;

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
  const stream = parsed.data.stream === true;
  const responseMode = parsed.data.responseMode ?? "text";

  let sources: Awaited<ReturnType<typeof retrieveLoreSources>>;
  try {
    const baseFilters: SearchFilters = { spaceId, limit };
    if (spaceId) {
      if (!(await gmMayAccessSpaceIdAsync(db, bootCtx, spaceId))) {
        return Response.json(
          { ok: false, error: "Forbidden.", answer: null, sources: [] },
          { status: 403 },
        );
      }
      const space = await assertSpaceExists(db, spaceId);
      if (!space) {
        return Response.json(
          { ok: false, error: "Space not found", answer: null, sources: [] },
          { status: 404 },
        );
      }
    }
    const finalized = await finalizeHeartgardenSearchFiltersForDb(db, bootCtx, baseFilters);
    if (!finalized) {
      return Response.json(
        { ok: false, error: "Forbidden.", answer: null, sources: [] },
        { status: 403 },
      );
    }
    sources = await retrieveLoreSources(db, question, finalized);
    maybeLogLoreQueryMetric("retrieval", {
      sourceCount: sources.length,
      scoped: Boolean(spaceId),
      mode: responseMode,
      stream,
    });
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
    const noMatchAnswer =
      "No canvas items matched that question (lexical retrieval). Try different wording, ensure notes have searchable text, or add content to the space.";
    if (stream) {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          const enc = new TextEncoder();
          controller.enqueue(enc.encode(sseFrame("meta", { sources: [], model: null })));
          controller.enqueue(enc.encode(sseFrame("delta", { text: noMatchAnswer })));
          controller.enqueue(
            enc.encode(sseFrame("done", { answer: noMatchAnswer, sources: [], model: null })),
          );
          controller.close();
        },
      });
      return new Response(body, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }
    return Response.json({
      ok: true,
      answer: noMatchAnswer,
      sources: [],
      model: null,
    });
  }

  const model = (process.env.ANTHROPIC_LORE_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;

  try {
    if (stream) {
      if (responseMode === "grounded_json") {
        return Response.json(
          { ok: false, error: "Streaming is only supported for responseMode=text." },
          { status: 400 },
        );
      }
      const streamBody = new ReadableStream<Uint8Array>({
        async start(controller) {
          const enc = new TextEncoder();
          let full = "";
          controller.enqueue(enc.encode(sseFrame("meta", { sources, model })));
          try {
            for await (const chunk of synthesizeLoreAnswerStream(apiKey, model, question, sources)) {
              full += chunk;
              controller.enqueue(enc.encode(sseFrame("delta", { text: chunk })));
            }
            maybeLogLoreQueryMetric("stream_done", {
              sourceCount: sources.length,
              outputChars: full.length,
              model,
            });
            controller.enqueue(enc.encode(sseFrame("done", { answer: full, sources, model })));
          } catch (err) {
            const msg =
              err instanceof Error
                ? err.message
                : "Lore synthesis failed (check ANTHROPIC_LORE_MODEL and API access)";
            controller.enqueue(enc.encode(sseFrame("error", { message: msg })));
          } finally {
            controller.close();
          }
        },
      });
      return new Response(streamBody, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    if (responseMode === "grounded_json") {
      const grounded = await synthesizeLoreAnswerGrounded(apiKey, model, question, sources);
      maybeLogLoreQueryMetric("grounded_done", {
        sourceCount: sources.length,
        citedCount: grounded.citedItemIds.length,
        insufficientEvidence: grounded.insufficientEvidence,
        model,
      });
      return Response.json({
        ok: true,
        answer: grounded.answerText,
        grounded,
        sources,
        model,
      });
    }
    const answer = await synthesizeLoreAnswer(apiKey, model, question, sources);
    maybeLogLoreQueryMetric("text_done", {
      sourceCount: sources.length,
      outputChars: answer.length,
      model,
    });
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
