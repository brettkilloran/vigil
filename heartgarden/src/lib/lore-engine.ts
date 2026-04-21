/**
 * Lore Q&A pipeline: hybrid vault retrieval (`hybridRetrieveItems` + link expansion)
 * → excerpt shaping → Anthropic completion. Used by `POST /api/lore/query`.
 */
import {
  buildCachedSystem,
  callAnthropic,
  callAnthropicTextStream,
} from "@/src/lib/anthropic-client";

import type { tryGetDb } from "@/src/db/index";
import type { SearchFilters, SearchRow } from "@/src/lib/spaces";
import { LORE_HYBRID_OPTIONS } from "@/src/lib/vault-retrieval-profiles";
import { sanitizeRetrievedTextForLorePrompt } from "@/src/lib/lore-prompt-sanitize";
import {
  budgetPerSource,
  excerptForLore,
  expandHgArchBindingNeighbors,
  expandLinkedItems,
  expandProseLinkedItems,
  hybridRetrieveItems,
} from "@/src/lib/vault-retrieval";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

export type LoreSource = {
  itemId: string;
  title: string;
  spaceId: string;
  spaceName: string;
  excerpt: string;
  /** `entity_meta.canonicalEntityKind` (e.g. `npc`, `location`, `faction`). */
  canonicalEntityKind?: string | null;
  /** Semantic chunk texts surfaced for this item (UI / transparency). */
  matchedChunks?: string[];
  /** Included via 1-hop item_links from primary hits. */
  viaGraph?: boolean;
  /** Included because a primary hit's body cites `vigil:item:` (wiki-style). */
  viaProse?: boolean;
  /** Included via hgArch binding slots on a primary hit (no `item_links` required). */
  viaBinding?: boolean;
};

export type LoreGroundedAnswer = {
  answerText: string;
  citedItemIds: string[];
  insufficientEvidence: boolean;
};

function readCanonicalEntityKind(row: SearchRow): string | null {
  const meta = row.item.entityMeta;
  if (!meta || typeof meta !== "object") return null;
  const raw = (meta as Record<string, unknown>).canonicalEntityKind;
  if (typeof raw !== "string") return null;
  const slug = raw.trim().toLowerCase();
  if (!slug || slug.length > 32 || !/^[a-z][a-z0-9_-]*$/.test(slug)) return null;
  return slug;
}

const LORE_SYSTEM = `You are Heartgarden's lore assistant for tabletop RPG worldbuilding.

Rules:
- Answer only from the "Canvas excerpts" the user provides. If they are insufficient, say what is missing and suggest what to add on the canvas.
- Be concise and in-world when the excerpts support it; otherwise stay neutral and factual.
- When you cite a fact, mention the source title (and space name if helpful).
- Use each source's \`kind\` hint (e.g. npc, location, faction, artifact) to keep references grounded in the right kind of entity; do not conflate kinds.
- Do not invent proper nouns, dates, or relationships not grounded in the excerpts.`;

function fallbackExcerpt(row: SearchRow, maxChars: number): string {
  const blob = [row.item.title, row.item.contentText].filter(Boolean).join("\n\n").trim();
  if (!blob) return "(empty note)";
  if (blob.length <= maxChars) return blob;
  return `${blob.slice(0, maxChars)}…`;
}

/**
 * Hybrid lexical + vector chunk retrieval, optional 1-hop graph expansion, query-biased excerpts.
 */
export async function retrieveLoreSources(
  db: VigilDb,
  question: string,
  filters: SearchFilters = {},
): Promise<LoreSource[]> {
  const q = question.trim().slice(0, 500);
  if (!q) return [];

  const cap = Math.min(Math.max(filters.limit ?? 14, 1), 20);
  const base: SearchFilters = { ...filters, limit: cap };

  const { rows, itemIdToChunks, itemIdToFtsSnippet } = await hybridRetrieveItems(db, q, base, {
    ...LORE_HYBRID_OPTIONS,
    maxItems: cap,
    includeVector: true,
  });

  const graphRows = await expandLinkedItems(
    db,
    rows.map((r) => r.item.id),
    base,
    Math.min(10, Math.max(0, 20 - rows.length)),
  );
  const maxOut = 20;

  const proseCap = Math.min(
    6,
    Math.max(0, maxOut - rows.length - graphRows.length),
  );
  const proseRows =
    proseCap > 0 ? await expandProseLinkedItems(db, rows, base, proseCap) : [];

  const bindingCap = Math.min(
    6,
    Math.max(0, maxOut - rows.length - graphRows.length - proseRows.length),
  );
  const bindingRows =
    bindingCap > 0 ? await expandHgArchBindingNeighbors(db, rows, base, bindingCap) : [];

  const total = rows.length + graphRows.length + proseRows.length + bindingRows.length;
  const primaryBudget = budgetPerSource(total, 14_000);
  const graphBudget = Math.min(900, Math.floor(primaryBudget * 0.55));

  const out: LoreSource[] = [];

  for (const row of rows) {
    const chunks = itemIdToChunks.get(row.item.id);
    const excerpt = excerptForLore(row, itemIdToChunks, itemIdToFtsSnippet, primaryBudget);
    out.push({
      itemId: row.item.id,
      title: row.item.title?.trim() || "Untitled",
      spaceId: row.space.id,
      spaceName: row.space.name,
      excerpt,
      canonicalEntityKind: readCanonicalEntityKind(row),
      matchedChunks: chunks?.length ? chunks : undefined,
    });
  }

  const primaryIds = new Set(rows.map((r) => r.item.id));
  const graphIds = new Set(graphRows.map((r) => r.item.id));
  const proseIds = new Set(proseRows.map((r) => r.item.id));
  for (const row of graphRows) {
    if (out.length >= maxOut) break;
    if (primaryIds.has(row.item.id)) continue;
    out.push({
      itemId: row.item.id,
      title: row.item.title?.trim() || "Untitled",
      spaceId: row.space.id,
      spaceName: row.space.name,
      excerpt: fallbackExcerpt(row, graphBudget),
      canonicalEntityKind: readCanonicalEntityKind(row),
      viaGraph: true,
    });
  }

  for (const row of proseRows) {
    if (out.length >= maxOut) break;
    if (primaryIds.has(row.item.id) || graphIds.has(row.item.id)) continue;
    out.push({
      itemId: row.item.id,
      title: row.item.title?.trim() || "Untitled",
      spaceId: row.space.id,
      spaceName: row.space.name,
      excerpt: fallbackExcerpt(row, graphBudget),
      canonicalEntityKind: readCanonicalEntityKind(row),
      viaProse: true,
    });
  }

  for (const row of bindingRows) {
    if (out.length >= maxOut) break;
    if (primaryIds.has(row.item.id) || graphIds.has(row.item.id) || proseIds.has(row.item.id)) {
      continue;
    }
    out.push({
      itemId: row.item.id,
      title: row.item.title?.trim() || "Untitled",
      spaceId: row.space.id,
      spaceName: row.space.name,
      excerpt: fallbackExcerpt(row, graphBudget),
      canonicalEntityKind: readCanonicalEntityKind(row),
      viaBinding: true,
    });
  }

  return out;
}

export async function synthesizeLoreAnswer(
  apiKey: string,
  model: string,
  question: string,
  sources: LoreSource[],
): Promise<string> {
  const blocks = sources.map((s, i) => {
    const body = sanitizeRetrievedTextForLorePrompt(s.excerpt);
    const ctx = s.viaGraph
      ? "\n- context: canvas connection neighbor"
      : s.viaProse
        ? "\n- context: cited in note text"
        : s.viaBinding
          ? "\n- context: structured card field (hgArch binding target)"
          : "";
    const kindLine = s.canonicalEntityKind ? `\n- kind: ${s.canonicalEntityKind}` : "";
    return `### Source ${i + 1}\n- itemId: ${s.itemId}\n- title: ${s.title}\n- space: ${s.spaceName}${kindLine}${ctx}\n\n${body}`;
  });
  const user = `Question:\n${question.trim()}\n\n---\n\nCanvas excerpts (your only ground truth):\n\n${blocks.join("\n\n---\n\n")}`;

  const res = await callAnthropic(
    apiKey,
    {
      model,
      system: buildCachedSystem(LORE_SYSTEM),
      messages: [{ role: "user", content: user }],
    },
    { label: "lore.query.answer" },
  );

  return res.text;
}

export async function* synthesizeLoreAnswerStream(
  apiKey: string,
  model: string,
  question: string,
  sources: LoreSource[],
): AsyncGenerator<string> {
  const blocks = sources.map((s, i) => {
    const body = sanitizeRetrievedTextForLorePrompt(s.excerpt);
    const ctx = s.viaGraph
      ? "\n- context: canvas connection neighbor"
      : s.viaProse
        ? "\n- context: cited in note text"
        : s.viaBinding
          ? "\n- context: structured card field (hgArch binding target)"
          : "";
    const kindLine = s.canonicalEntityKind ? `\n- kind: ${s.canonicalEntityKind}` : "";
    return `### Source ${i + 1}\n- itemId: ${s.itemId}\n- title: ${s.title}\n- space: ${s.spaceName}${kindLine}${ctx}\n\n${body}`;
  });
  const user = `Question:\n${question.trim()}\n\n---\n\nCanvas excerpts (your only ground truth):\n\n${blocks.join("\n\n---\n\n")}`;
  yield* callAnthropicTextStream(
    apiKey,
    {
      model,
      system: buildCachedSystem(LORE_SYSTEM),
      messages: [{ role: "user", content: user }],
    },
    { label: "lore.query.answer" },
  );
}

const LORE_GROUNDED_SYSTEM = `${LORE_SYSTEM}

Additionally, return ONLY valid JSON with this exact shape:
{
  "answer_text": "string",
  "cited_item_ids": ["item uuid from sources", ...],
  "insufficient_evidence": boolean
}

Rules:
- cited_item_ids must contain only itemId values from the provided sources.
- If evidence is weak/incomplete, set insufficient_evidence=true and explain limits in answer_text.
- Do not add markdown fences or prose outside JSON.`;

export function normalizeGroundedLoreAnswer(
  value: unknown,
  sources: LoreSource[],
): LoreGroundedAnswer {
  const sourceIds = new Set(sources.map((s) => s.itemId));
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const answerText = String(raw.answer_text ?? "").trim();
  const citedRaw = Array.isArray(raw.cited_item_ids) ? raw.cited_item_ids : [];
  const citedItemIds = citedRaw
    .map((x) => String(x ?? "").trim())
    .filter((id, idx, arr) => id && sourceIds.has(id) && arr.indexOf(id) === idx);
  const insufficientEvidence = raw.insufficient_evidence === true;
  return {
    answerText,
    citedItemIds,
    insufficientEvidence,
  };
}

export function groundedLoreAnswerContractIssue(answer: LoreGroundedAnswer): string | null {
  if (!answer.answerText.trim()) {
    return "empty_answer_text";
  }
  if (!answer.insufficientEvidence && answer.citedItemIds.length === 0) {
    return "missing_citations";
  }
  return null;
}

export async function synthesizeLoreAnswerGrounded(
  apiKey: string,
  model: string,
  question: string,
  sources: LoreSource[],
): Promise<LoreGroundedAnswer> {
  const blocks = sources.map((s, i) => {
    const body = sanitizeRetrievedTextForLorePrompt(s.excerpt);
    const ctx = s.viaGraph
      ? "\n- context: canvas connection neighbor"
      : s.viaProse
        ? "\n- context: cited in note text"
        : s.viaBinding
          ? "\n- context: structured card field (hgArch binding target)"
          : "";
    const kindLine = s.canonicalEntityKind ? `\n- kind: ${s.canonicalEntityKind}` : "";
    return `### Source ${i + 1}\n- itemId: ${s.itemId}\n- title: ${s.title}\n- space: ${s.spaceName}${kindLine}${ctx}\n\n${body}`;
  });
  const user = `Question:\n${question.trim()}\n\n---\n\nCanvas excerpts (your only ground truth):\n\n${blocks.join("\n\n---\n\n")}`;
  const res = await callAnthropic(
    apiKey,
    {
      model,
      system: buildCachedSystem(LORE_GROUNDED_SYSTEM),
      messages: [{ role: "user", content: user }],
    },
    { label: "lore.query.answer", expectJson: true },
  );
  const grounded = normalizeGroundedLoreAnswer(res.parsedJson, sources);
  const issue = groundedLoreAnswerContractIssue(grounded);
  if (issue) {
    throw new Error(`lore.query.answer grounded contract violation: ${issue}`);
  }
  return grounded;
}
