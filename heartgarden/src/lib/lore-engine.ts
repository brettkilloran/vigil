/**
 * Lore Q&A pipeline: hybrid vault retrieval (`hybridRetrieveItems` + link expansion)
 * → excerpt shaping → Anthropic completion. Used by `POST /api/lore/query`.
 */
import Anthropic from "@anthropic-ai/sdk";

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
  /** Semantic chunk texts surfaced for this item (UI / transparency). */
  matchedChunks?: string[];
  /** Included via 1-hop item_links from primary hits. */
  viaGraph?: boolean;
  /** Included because a primary hit's body cites `vigil:item:` (wiki-style). */
  viaProse?: boolean;
  /** Included via hgArch binding slots on a primary hit (no `item_links` required). */
  viaBinding?: boolean;
};

const LORE_SYSTEM = `You are Heartgarden's lore assistant for tabletop RPG worldbuilding.

Rules:
- Answer only from the "Canvas excerpts" the user provides. If they are insufficient, say what is missing and suggest what to add on the canvas.
- Be concise and in-world when the excerpts support it; otherwise stay neutral and factual.
- When you cite a fact, mention the source title (and space name if helpful).
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
      viaBinding: true,
    });
  }

  return out;
}

function messageText(message: Anthropic.Message): string {
  const parts: string[] = [];
  for (const block of message.content) {
    if (block.type === "text") parts.push(block.text);
  }
  return parts.join("\n").trim();
}

export async function synthesizeLoreAnswer(
  apiKey: string,
  model: string,
  question: string,
  sources: LoreSource[],
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const blocks = sources.map((s, i) => {
    const body = sanitizeRetrievedTextForLorePrompt(s.excerpt);
    const ctx = s.viaGraph
      ? "\n- context: canvas connection neighbor"
      : s.viaProse
        ? "\n- context: cited in note text"
        : s.viaBinding
          ? "\n- context: structured card field (hgArch binding target)"
          : "";
    return `### Source ${i + 1}\n- itemId: ${s.itemId}\n- title: ${s.title}\n- space: ${s.spaceName}${ctx}\n\n${body}`;
  });
  const user = `Question:\n${question.trim()}\n\n---\n\nCanvas excerpts (your only ground truth):\n\n${blocks.join("\n\n---\n\n")}`;

  const res = await client.messages.create({
    model,
    max_tokens: 4096,
    system: LORE_SYSTEM,
    messages: [{ role: "user", content: user }],
  });

  return messageText(res);
}
