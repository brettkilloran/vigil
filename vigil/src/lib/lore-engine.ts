import Anthropic from "@anthropic-ai/sdk";

import type { tryGetDb } from "@/src/db/index";
import {
  searchItemsFTS,
  searchItemsFuzzy,
  type SearchFilters,
  type SearchRow,
} from "@/src/lib/spaces";

type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

export type LoreSource = {
  itemId: string;
  title: string;
  spaceId: string;
  spaceName: string;
  excerpt: string;
};

const LORE_SYSTEM = `You are Heartgarden's lore assistant for tabletop RPG worldbuilding.

Rules:
- Answer only from the "Canvas excerpts" the user provides. If they are insufficient, say what is missing and suggest what to add on the canvas.
- Be concise and in-world when the excerpts support it; otherwise stay neutral and factual.
- When you cite a fact, mention the source title (and space name if helpful).
- Do not invent proper nouns, dates, or relationships not grounded in the excerpts.`;

function excerptFromRow(row: SearchRow, maxChars: number): string {
  const blob = [row.item.title, row.item.contentText].filter(Boolean).join("\n\n").trim();
  if (!blob) return "(empty note)";
  if (blob.length <= maxChars) return blob;
  return `${blob.slice(0, maxChars)}…`;
}

export function searchRowToLoreSource(row: SearchRow, maxChars = 1600): LoreSource {
  return {
    itemId: row.item.id,
    title: row.item.title?.trim() || "Untitled",
    spaceId: row.space.id,
    spaceName: row.space.name,
    excerpt: excerptFromRow(row, maxChars),
  };
}

/**
 * Retrieves candidate canvas items for lore Q&A using Postgres FTS, then trigram title fuzzy match.
 * Does not use vector embeddings (works with ANTHROPIC_API_KEY only).
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

  let rows = await searchItemsFTS(db, q, base);
  if (rows.length === 0) {
    rows = await searchItemsFuzzy(db, q, { ...base, limit: Math.min(cap, 12) });
  }

  const seen = new Set<string>();
  const out: LoreSource[] = [];
  for (const row of rows) {
    if (seen.has(row.item.id)) continue;
    seen.add(row.item.id);
    out.push(searchRowToLoreSource(row));
    if (out.length >= cap) break;
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
  const blocks = sources.map(
    (s, i) =>
      `### Source ${i + 1}\n- itemId: ${s.itemId}\n- title: ${s.title}\n- space: ${s.spaceName}\n\n${s.excerpt}`,
  );
  const user = `Question:\n${question.trim()}\n\n---\n\nCanvas excerpts (your only ground truth):\n\n${blocks.join("\n\n---\n\n")}`;

  const res = await client.messages.create({
    model,
    max_tokens: 4096,
    system: LORE_SYSTEM,
    messages: [{ role: "user", content: user }],
  });

  return messageText(res);
}
