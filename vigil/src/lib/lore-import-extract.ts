import Anthropic from "@anthropic-ai/sdk";

import type {
  LoreImportEntityDraft,
  LoreImportExtractResult,
  LoreImportLinkDraft,
} from "@/src/lib/lore-import-types";

export type { LoreImportEntityDraft, LoreImportExtractResult, LoreImportLinkDraft };

const EXTRACT_SYSTEM = `You extract structured entities from TTRPG / worldbuilding source text for a canvas app.

Return ONLY valid JSON (no markdown fence) with this shape:
{
  "entities": [
    { "name": "string", "kind": "npc"|"location"|"faction"|"quest"|"item"|"lore"|"other", "summary": "string" }
  ],
  "suggestedLinks": [
    { "fromName": "string", "toName": "string", "linkType": "ally"|"enemy"|"neutral"|"faction"|"quest"|"location"|"lore"|"reference" }
  ]
}

Rules:
- "entities" should be proper nouns or clear story elements; keep summaries under 240 chars.
- "suggestedLinks" only when both names appear in entities; omit if unsure.
- If the text is empty, return {"entities":[],"suggestedLinks":[]}.`;

export async function extractLoreEntitiesWithAnthropic(
  apiKey: string,
  model: string,
  text: string,
): Promise<LoreImportExtractResult> {
  const client = new Anthropic({ apiKey });
  const trimmed = text.trim().slice(0, 120_000);
  const res = await client.messages.create({
    model,
    max_tokens: 4096,
    system: EXTRACT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Source text:\n\n${trimmed || "(empty)"}`,
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
    return { entities: [], suggestedLinks: [] };
  }
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      entities?: LoreImportEntityDraft[];
      suggestedLinks?: LoreImportLinkDraft[];
    };
    return {
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      suggestedLinks: Array.isArray(parsed.suggestedLinks) ? parsed.suggestedLinks : [],
    };
  } catch {
    return { entities: [], suggestedLinks: [] };
  }
}
