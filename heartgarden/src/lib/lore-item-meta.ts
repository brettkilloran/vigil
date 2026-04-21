import Anthropic from "@anthropic-ai/sdk";

/** Max chars of note text passed to the lore-meta model after trim (must match `item-vault-index` skip-hash). */
export const LORE_META_MAX_INPUT_CHARS = 24_000;

/** Same trim + cap as `extractLoreItemMeta` applies before the API call. */
export function normalizeLoreMetaInputText(text: string): string {
  return text.trim().slice(0, LORE_META_MAX_INPUT_CHARS);
}

const SYSTEM = `You index tabletop / worldbuilding notes for search. Return ONLY valid JSON (no markdown fence):
{"summary":"string under 280 chars","aliases":["short alternate names or epithets, max 12 entries"]}

Rules:
- summary: factual gist of who/what/where; no invention beyond the text.
- aliases: other ways someone might search for this note; empty array if none.
- If text is empty, return {"summary":"","aliases":[]}.`;

export type LoreItemMeta = { summary: string; aliases: string[] };

export async function extractLoreItemMeta(
  apiKey: string,
  model: string,
  text: string,
): Promise<LoreItemMeta> {
  const client = new Anthropic({ apiKey });
  const trimmed = normalizeLoreMetaInputText(text);
  const res = await client.messages.create({
    model,
    max_tokens: 512,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Note text:\n\n${trimmed || "(empty)"}`,
      },
    ],
  });
  let raw = "";
  for (const block of res.content) {
    if (block.type === "text") raw += block.text;
  }
  raw = raw.trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return { summary: "", aliases: [] };
  }
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      summary?: string;
      aliases?: string[];
    };
    const summary =
      typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 400) : "";
    const aliases = Array.isArray(parsed.aliases)
      ? parsed.aliases
          .filter((a): a is string => typeof a === "string")
          .map((a) => a.trim())
          .filter(Boolean)
          .slice(0, 12)
      : [];
    return { summary, aliases };
  } catch {
    return { summary: "", aliases: [] };
  }
}
