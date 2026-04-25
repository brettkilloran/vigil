import { buildCachedSystem, callAnthropic } from "@/src/lib/anthropic-client";
import { extractHgArchBoundItemIds } from "@/src/lib/hg-arch-binding-projection";
import type { VigilDb } from "@/src/lib/spaces";
import { hybridRetrieveItems } from "@/src/lib/vault-retrieval";
import { LORE_CONSISTENCY_HYBRID_OPTIONS } from "@/src/lib/vault-retrieval-profiles";

const VALID_TAG_RE = /^[a-z][a-z0-9_]*$/;

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
- When there are no candidates, still return suggestedNoteTags + semanticSummary if helpful; issues should usually be [].
- When a candidate includes structuredBindingTargets (hgArch item ids), flag a contradiction or warning if the draft clearly asserts a different employer, home, or membership than those bindings imply.`;

export interface LoreConsistencyIssue {
  candidateItemId?: string;
  details?: string;
  handlingHint?: string;
  severity: "info" | "warning" | "contradiction";
  summary: string;
}

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
    return { issues: [], semanticSummary: null, suggestedNoteTags: [] };
  }

  const hybrid = await hybridRetrieveItems(
    args.db,
    q,
    { spaceId: args.spaceId },
    {
      ...LORE_CONSISTENCY_HYBRID_OPTIONS,
      includeVector: true,
    }
  );

  const candidates = hybrid.rows
    .filter((r) => r.item.id !== args.excludeItemId)
    .slice(0, 10)
    .map((r) => {
      const snippet =
        hybrid.itemIdToFtsSnippet.get(r.item.id) ??
        hybrid.itemIdToChunks.get(r.item.id)?.[0] ??
        "";
      const structuredBindingTargets = extractHgArchBoundItemIds(
        r.item.contentJson as Record<string, unknown> | null | undefined
      );
      return {
        entityType: r.item.entityType,
        excerpt: String(snippet ?? "").slice(0, 1200),
        itemId: r.item.id,
        itemType: r.item.itemType,
        title: r.item.title ?? "",
        ...(structuredBindingTargets.length
          ? { structuredBindingTargets: structuredBindingTargets.slice(0, 16) }
          : {}),
      };
    });

  const user =
    candidates.length > 0
      ? `DRAFT NOTE:\nTitle: ${args.title.slice(0, 255)}\nBody:\n${args.bodyText.slice(0, 80_000)}\n\nCANDIDATES (JSON):\n${JSON.stringify(candidates).slice(0, 100_000)}`
      : `DRAFT NOTE (no related vault excerpts were retrieved — infer tags from the draft only):\nTitle: ${args.title.slice(0, 255)}\nBody:\n${args.bodyText.slice(0, 80_000)}`;

  const res = await callAnthropic(
    args.apiKey,
    {
      messages: [{ content: user, role: "user" }],
      model: args.model,
      system: buildCachedSystem(SYSTEM),
    },
    { expectJson: true, label: "lore.consistency" }
  );
  return parseLoreConsistencyResponse(
    res.jsonText,
    new Set(candidates.map((c) => c.itemId))
  );
}

function parseLoreConsistencyIssue(
  raw: unknown,
  allowedIds: Set<string>
): LoreConsistencyIssue | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const summary = String(o.summary ?? "")
    .trim()
    .slice(0, 500);
  if (!summary) {
    return null;
  }
  const sevRaw = String(o.severity ?? "warning");
  const severity =
    sevRaw === "info" || sevRaw === "contradiction" ? sevRaw : "warning";
  const candidateItemId =
    typeof o.candidateItemId === "string" && allowedIds.has(o.candidateItemId)
      ? o.candidateItemId
      : undefined;
  const hintRaw =
    o.handlingHint == null ? "" : String(o.handlingHint).trim().slice(0, 64);
  return {
    candidateItemId,
    details:
      o.details == null ? undefined : String(o.details).trim().slice(0, 2000),
    handlingHint: hintRaw || undefined,
    severity,
    summary,
  };
}

function parseSuggestedNoteTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: string[] = [];
  for (const t of raw) {
    const s = String(t ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48);
    if (s && VALID_TAG_RE.test(s)) {
      out.push(s);
    }
  }
  return out;
}

function parseLoreConsistencyResponse(
  jsonStr: string | null | undefined,
  allowedIds: Set<string>
): {
  issues: LoreConsistencyIssue[];
  suggestedNoteTags: string[];
  semanticSummary: string | null;
} {
  const empty = {
    issues: [] as LoreConsistencyIssue[],
    semanticSummary: null,
    suggestedNoteTags: [] as string[],
  };
  if (!jsonStr) {
    return empty;
  }
  try {
    const parsed = JSON.parse(jsonStr) as {
      issues?: unknown[];
      suggestedNoteTags?: unknown;
      semanticSummary?: unknown;
    };
    const issues: LoreConsistencyIssue[] = [];
    for (const it of parsed.issues ?? []) {
      const issue = parseLoreConsistencyIssue(it, allowedIds);
      if (issue) {
        issues.push(issue);
      }
    }
    const suggestedNoteTags = parseSuggestedNoteTags(parsed.suggestedNoteTags);
    const semanticSummary =
      parsed.semanticSummary == null
        ? null
        : String(parsed.semanticSummary).trim().slice(0, 500) || null;
    return { issues, semanticSummary, suggestedNoteTags };
  } catch {
    return empty;
  }
}
