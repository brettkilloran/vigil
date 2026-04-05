import Anthropic from "@anthropic-ai/sdk";

import { extractJsonObject } from "@/src/lib/lore-import-plan-llm";
import type { VigilDb } from "@/src/lib/spaces";
import { hybridRetrieveItems } from "@/src/lib/vault-retrieval";

const SYSTEM = `You review a draft note for a TTRPG / worldbuilding canvas.

Return ONLY valid JSON (no markdown fence):
{
  "issues": [
    {
      "summary": "one line",
      "severity": "info" | "warning" | "contradiction",
      "details": "optional",
      "candidateItemId": "optional uuid from candidates when relevant",
      "handlingHint": "optional: label_only | review_with_vault | crosslink_only | no_structural_change"
    }
  ],
  "suggestedNoteTags": ["slug_case", ...],
  "semanticSummary": "optional one sentence — role of the note (flavor vs crunch, canon voice, etc.)"
}

Rules:
- **issues**: real tensions vs retrieved candidates when candidates exist; empty array if none. For soft cases prefer severity "info" or "warning" and handlingHint "label_only" or "no_structural_change" instead of treating as errors.
- **suggestedNoteTags**: 0–8 machine tags for the draft itself (e.g. flavor_not_crunch, uncertain_canon, gm_note_layer, table_advice, needs_crosslink). Lowercase slug_case with underscores. Empty array if none.
- **semanticSummary**: omit if nothing useful.
- Never invent candidateItemId values — only copy from the candidates list when provided.
- When there are no candidates, still return suggestedNoteTags + semanticSummary if helpful; issues should usually be [].`;

export type LoreConsistencyIssue = {
  summary: string;
  severity: "info" | "warning" | "contradiction";
  details?: string;
  candidateItemId?: string;
  handlingHint?: string;
};

export async function runLoreConsistencyCheck(args: {
  db: VigilDb;
  apiKey: string;
  model: string;
  spaceId: string;
  title: string;
  bodyText: string;
  excludeItemId?: string;
}): Promise<{
  issues: LoreConsistencyIssue[];
  suggestedNoteTags: string[];
  semanticSummary: string | null;
}> {
  const q = `${args.title} ${args.bodyText}`.trim().slice(0, 2000);
  if (!q) {
    return { issues: [], suggestedNoteTags: [], semanticSummary: null };
  }

  const hybrid = await hybridRetrieveItems(
    args.db,
    q,
    { spaceId: args.spaceId },
    { maxItems: 12, includeVector: true },
  );

  const candidates = hybrid.rows
    .filter((r) => r.item.id !== args.excludeItemId)
    .slice(0, 10)
    .map((r) => {
      const snippet =
        hybrid.itemIdToFtsSnippet.get(r.item.id) ??
        (hybrid.itemIdToChunks.get(r.item.id)?.[0] ?? "");
      return {
        itemId: r.item.id,
        title: r.item.title ?? "",
        itemType: r.item.itemType,
        entityType: r.item.entityType,
        excerpt: String(snippet ?? "").slice(0, 1200),
      };
    });

  const client = new Anthropic({ apiKey: args.apiKey });
  const user =
    candidates.length > 0
      ? `DRAFT NOTE:\nTitle: ${args.title.slice(0, 255)}\nBody:\n${args.bodyText.slice(0, 24_000)}\n\nCANDIDATES (JSON):\n${JSON.stringify(candidates).slice(0, 100_000)}`
      : `DRAFT NOTE (no related vault excerpts were retrieved — infer tags from the draft only):\nTitle: ${args.title.slice(0, 255)}\nBody:\n${args.bodyText.slice(0, 24_000)}`;

  const res = await client.messages.create({
    model: args.model,
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });
  let raw = "";
  for (const block of res.content) {
    if (block.type === "text") raw += block.text;
  }
  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) {
    return { issues: [], suggestedNoteTags: [], semanticSummary: null };
  }
  try {
    const parsed = JSON.parse(jsonStr) as {
      issues?: unknown[];
      suggestedNoteTags?: unknown;
      semanticSummary?: unknown;
    };
    const issues: LoreConsistencyIssue[] = [];
    const allowedIds = new Set(candidates.map((c) => c.itemId));
    for (const it of parsed.issues ?? []) {
      if (!it || typeof it !== "object") continue;
      const o = it as Record<string, unknown>;
      const summary = String(o.summary ?? "").trim().slice(0, 500);
      if (!summary) continue;
      const sevRaw = String(o.severity ?? "warning");
      const severity =
        sevRaw === "info" || sevRaw === "contradiction" ? sevRaw : "warning";
      const candidateItemId =
        typeof o.candidateItemId === "string" && allowedIds.has(o.candidateItemId)
          ? o.candidateItemId
          : undefined;
      const hintRaw =
        o.handlingHint != null ? String(o.handlingHint).trim().slice(0, 64) : "";
      const handlingHint = hintRaw || undefined;
      issues.push({
        summary,
        severity,
        details:
          o.details != null ? String(o.details).trim().slice(0, 2000) : undefined,
        candidateItemId,
        handlingHint,
      });
    }

    const suggestedNoteTags: string[] = [];
    if (Array.isArray(parsed.suggestedNoteTags)) {
      for (const t of parsed.suggestedNoteTags) {
        const s = String(t ?? "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 48);
        if (s && /^[a-z][a-z0-9_]*$/.test(s)) suggestedNoteTags.push(s);
      }
    }

    const semanticSummary =
      parsed.semanticSummary != null
        ? String(parsed.semanticSummary).trim().slice(0, 500) || null
        : null;

    return { issues, suggestedNoteTags, semanticSummary };
  } catch {
    return { issues: [], suggestedNoteTags: [], semanticSummary: null };
  }
}
