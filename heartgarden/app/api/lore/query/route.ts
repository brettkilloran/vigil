import { z } from "zod";

import { tryGetDb } from "@/src/db/index";
import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
  gmMayAccessSpaceIdAsync,
} from "@/src/lib/heartgarden-api-boot-context";
import { finalizeHeartgardenSearchFiltersForDb } from "@/src/lib/heartgarden-search-tier-policy";
import {
  retrieveLoreSources,
  synthesizeLoreAnswer,
  synthesizeLoreAnswerGrounded,
  synthesizeLoreAnswerStream,
} from "@/src/lib/lore-engine";
import { loreQueryRateLimitExceeded } from "@/src/lib/lore-query-rate-limit";
import { assertSpaceExists, type SearchFilters } from "@/src/lib/spaces";

const bodySchema = z.object({
  limit: z.number().int().min(1).max(24).optional(),
  question: z.string().min(1).max(4000),
  responseMode: z.enum(["text", "grounded_json"]).optional(),
  spaceId: z.string().uuid().optional(),
  stream: z.boolean().optional(),
});

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export const runtime = "nodejs";

function maybeLogLoreQueryMetric(
  event: string,
  payload: Record<string, unknown>
): void {
  const raw = (
    process.env.HEARTGARDEN_ANTHROPIC_METRICS_SAMPLE_RATE ?? ""
  ).trim();
  const rate = Number(raw);
  if (!Number.isFinite(rate)) {
    return;
  }
  const clamped = Math.max(0, Math.min(1, rate));
  if (Math.random() >= clamped) {
    return;
  }
  try {
    console.info(
      `[lore-query-metric] ${JSON.stringify({ event, ...payload })}`
    );
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
  if (denied) {
    return denied;
  }

  if ((process.env.HEARTGARDEN_LORE_QUERY_DISABLED ?? "").trim() === "1") {
    return Response.json(
      {
        answer: null,
        error:
          "Lore query is disabled on this deployment (HEARTGARDEN_LORE_QUERY_DISABLED).",
        ok: false,
        sources: [],
      },
      { status: 503 }
    );
  }

  if (loreQueryRateLimitExceeded(req)) {
    return Response.json(
      {
        answer: null,
        error: "Too many lore requests. Try again in a minute.",
        ok: false,
        sources: [],
      },
      { status: 429 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        answer: null,
        error: "ANTHROPIC_API_KEY not set",
        ok: false,
        sources: [],
      },
      { status: 503 }
    );
  }

  const db = tryGetDb();
  if (!db) {
    return Response.json(
      {
        answer: null,
        error: "Database not configured",
        ok: false,
        sources: [],
      },
      { status: 503 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json(
      { answer: null, error: "Invalid JSON", ok: false, sources: [] },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { answer: null, error: parsed.error.flatten(), ok: false, sources: [] },
      { status: 400 }
    );
  }

  const { question, spaceId, limit } = parsed.data;
  const stream = parsed.data.stream === true;
  const responseMode = parsed.data.responseMode ?? "text";

  let sources: Awaited<ReturnType<typeof retrieveLoreSources>>;
  try {
    const baseFilters: SearchFilters = { limit, spaceId };
    if (spaceId) {
      if (!(await gmMayAccessSpaceIdAsync(db, bootCtx, spaceId))) {
        return Response.json(
          { answer: null, error: "Forbidden.", ok: false, sources: [] },
          { status: 403 }
        );
      }
      const space = await assertSpaceExists(db, spaceId);
      if (!space) {
        return Response.json(
          { answer: null, error: "Space not found", ok: false, sources: [] },
          { status: 404 }
        );
      }
    }
    const finalized = await finalizeHeartgardenSearchFiltersForDb(
      db,
      bootCtx,
      baseFilters
    );
    if (!finalized) {
      return Response.json(
        { answer: null, error: "Forbidden.", ok: false, sources: [] },
        { status: 403 }
      );
    }
    sources = await retrieveLoreSources(db, question, finalized);
    maybeLogLoreQueryMetric("retrieval", {
      mode: responseMode,
      scoped: Boolean(spaceId),
      sourceCount: sources.length,
      stream,
    });
  } catch (err) {
    console.error("[lore/query] retrieval", err);
    return Response.json(
      {
        answer: null,
        error:
          "Lore retrieval failed (check database and search configuration).",
        ok: false,
        sources: [],
      },
      { status: 500 }
    );
  }

  if (sources.length === 0) {
    const noMatchAnswer =
      "No canvas items matched that question (lexical retrieval). Try different wording, ensure notes have searchable text, or add content to the space.";
    if (stream) {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          const enc = new TextEncoder();
          controller.enqueue(
            enc.encode(sseFrame("meta", { model: null, sources: [] }))
          );
          controller.enqueue(
            enc.encode(sseFrame("delta", { text: noMatchAnswer }))
          );
          controller.enqueue(
            enc.encode(
              sseFrame("done", {
                answer: noMatchAnswer,
                model: null,
                sources: [],
              })
            )
          );
          controller.close();
        },
      });
      return new Response(body, {
        headers: {
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream; charset=utf-8",
        },
      });
    }
    return Response.json({
      answer: noMatchAnswer,
      model: null,
      ok: true,
      sources: [],
    });
  }

  const model =
    (process.env.ANTHROPIC_LORE_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;

  try {
    if (stream) {
      if (responseMode === "grounded_json") {
        return Response.json(
          {
            error: "Streaming is only supported for responseMode=text.",
            ok: false,
          },
          { status: 400 }
        );
      }
      const streamBody = new ReadableStream<Uint8Array>({
        async start(controller) {
          const enc = new TextEncoder();
          let full = "";
          controller.enqueue(enc.encode(sseFrame("meta", { model, sources })));
          try {
            for await (const chunk of synthesizeLoreAnswerStream(
              apiKey,
              model,
              question,
              sources
            )) {
              full += chunk;
              controller.enqueue(
                enc.encode(sseFrame("delta", { text: chunk }))
              );
            }
            maybeLogLoreQueryMetric("stream_done", {
              model,
              outputChars: full.length,
              sourceCount: sources.length,
            });
            controller.enqueue(
              enc.encode(sseFrame("done", { answer: full, model, sources }))
            );
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
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream; charset=utf-8",
        },
      });
    }

    if (responseMode === "grounded_json") {
      const grounded = await synthesizeLoreAnswerGrounded(
        apiKey,
        model,
        question,
        sources
      );
      maybeLogLoreQueryMetric("grounded_done", {
        citedCount: grounded.citedItemIds.length,
        insufficientEvidence: grounded.insufficientEvidence,
        model,
        sourceCount: sources.length,
      });
      return Response.json({
        answer: grounded.answerText,
        grounded,
        model,
        ok: true,
        sources,
      });
    }
    const answer = await synthesizeLoreAnswer(apiKey, model, question, sources);
    maybeLogLoreQueryMetric("text_done", {
      model,
      outputChars: answer.length,
      sourceCount: sources.length,
    });
    return Response.json({
      answer,
      model,
      ok: true,
      sources,
    });
  } catch {
    return Response.json(
      {
        answer: null,
        error:
          "Lore synthesis failed (check ANTHROPIC_LORE_MODEL and API access)",
        ok: false,
        sources,
      },
      { status: 502 }
    );
  }
}
