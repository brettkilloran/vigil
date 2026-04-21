import { buildCachedSystem, callAnthropic } from "@/src/lib/anthropic-client";

/** Max chars of note text passed to the lore-meta model after trim (must match `item-vault-index` skip-hash). */
export const LORE_META_MAX_INPUT_CHARS = 60_000;

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
  const trimmed = normalizeLoreMetaInputText(text);
  const res = await callAnthropic(
    apiKey,
    {
      model,
      system: buildCachedSystem(SYSTEM),
      messages: [
        {
          role: "user",
          content: `Note text:\n\n${trimmed || "(empty)"}`,
        },
      ],
    },
    { label: "lore.item_meta", expectJson: true },
  );
  if (!res.jsonText) {
    return { summary: "", aliases: [] };
  }
  try {
    const parsed = JSON.parse(res.jsonText) as {
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
