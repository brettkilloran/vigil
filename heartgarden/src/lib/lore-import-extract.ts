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

const EXTRACT_SEGMENT_CHARS = 95_000;
const EXTRACT_SEGMENT_OVERLAP = 6_000;
const EXTRACT_ENTITY_CAP = 220;

async function extractLoreEntitiesOneSegment(
  apiKey: string,
  model: string,
  segment: string,
): Promise<LoreImportExtractResult> {
  const client = new Anthropic({ apiKey });
  const trimmed = segment.trim();
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

function mergeExtractSegments(
  segments: LoreImportExtractResult[],
): LoreImportExtractResult {
  const byName = new Map<
    string,
    { name: string; kind?: string; summary?: string }
  >();
  outer: for (const s of segments) {
    for (const e of s.entities ?? []) {
      const name = String(e.name ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (byName.has(key)) continue;
      byName.set(key, {
        name,
        kind: e.kind?.trim() || undefined,
        summary: e.summary?.trim() || undefined,
      });
      if (byName.size >= EXTRACT_ENTITY_CAP) break outer;
    }
  }
  const entities: LoreImportEntityDraft[] = [...byName.values()].map((v) => ({
    name: v.name,
    kind: v.kind ?? "lore",
    summary: v.summary ?? "",
  }));
  const nameKeys = new Set(entities.map((e) => e.name.toLowerCase()));
  const linkKey = (a: string, b: string, t: string) =>
    `${a.toLowerCase()}|${b.toLowerCase()}|${t}`;
  const seenLinks = new Set<string>();
  const suggestedLinks: LoreImportLinkDraft[] = [];
  for (const s of segments) {
    for (const l of s.suggestedLinks ?? []) {
      const from = String(l.fromName ?? "").trim();
      const to = String(l.toName ?? "").trim();
      if (!from || !to) continue;
      if (!nameKeys.has(from.toLowerCase()) || !nameKeys.has(to.toLowerCase())) {
        continue;
      }
      const lt = (l.linkType ?? "reference").trim() || "reference";
      const k = linkKey(from, to, lt);
      if (seenLinks.has(k)) continue;
      seenLinks.add(k);
      suggestedLinks.push({ fromName: from, toName: to, linkType: l.linkType });
    }
  }
  return { entities, suggestedLinks };
}

export async function extractLoreEntitiesWithAnthropic(
  apiKey: string,
  model: string,
  text: string,
): Promise<LoreImportExtractResult> {
  const full = text.replace(/\0/g, "").trim();
  if (!full) {
    return { entities: [], suggestedLinks: [] };
  }

  if (full.length <= EXTRACT_SEGMENT_CHARS) {
    return extractLoreEntitiesOneSegment(apiKey, model, full);
  }

  const segments: string[] = [];
  const step = EXTRACT_SEGMENT_CHARS - EXTRACT_SEGMENT_OVERLAP;
  for (let pos = 0; pos < full.length; pos += step) {
    segments.push(full.slice(pos, pos + EXTRACT_SEGMENT_CHARS));
  }

  const results: LoreImportExtractResult[] = [];
  for (const seg of segments) {
    results.push(await extractLoreEntitiesOneSegment(apiKey, model, seg));
  }
  return mergeExtractSegments(results);
}
