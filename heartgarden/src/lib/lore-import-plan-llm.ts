import {
  normalizeCanonicalEntityKind,
  type CanonicalEntityKind,
} from "@/src/lib/lore-import-canonical-kinds";
import { buildCachedSystem, callAnthropic } from "@/src/lib/anthropic-client";
import {
  CANONICAL_RELATIONSHIP_LINK_TYPES,
  connectionKindsPromptGlossary,
} from "@/src/lib/connection-kind-colors";
import type { SourceTextChunk } from "@/src/lib/lore-import-chunk";
import type { IngestionSignals, LoreImportStructuredBody } from "@/src/lib/lore-import-plan-types";
import { HEARTGARDEN_NATIONS, isHeartgardenNation } from "@/src/lib/lore-nations";

/** Keep chunk list JSON under this so long docs still send every chunk id to the model. */
export const OUTLINE_CHUNK_LIST_JSON_MAX = 650_000;
const OUTLINE_SOURCE_SAMPLE_MAX = 400_000;
/** Merge / clarify payloads can be large when many notes exist; batch merge separately. */
const MERGE_USER_JSON_MAX = 420_000;
const CLARIFY_USER_JSON_MAX = 420_000;
const IMPORT_LINK_TYPE_ENUM = CANONICAL_RELATIONSHIP_LINK_TYPES.map((t) => `"${t}"`).join("|");
const IMPORT_LINK_TYPE_LIST = CANONICAL_RELATIONSHIP_LINK_TYPES.join(", ");
const IMPORT_LINK_TYPE_GLOSSARY = connectionKindsPromptGlossary();

const OUTLINE_SYSTEM = `You structure TTRPG / worldbuilding documents for a canvas notes app.

Return ONLY valid JSON (no markdown fence) with this exact shape:
{
  "folders": [
    { "clientId": "short id like f1", "title": "string", "parentClientId": null or another folder clientId }
  ],
  "notes": [
    {
      "clientId": "short id like n1",
      "title": "string",
      "canonicalEntityKind": "npc"|"location"|"faction"|"quest"|"item"|"lore"|"other",
      "summary": "string under 400 chars",
      "folderClientId": null or a folder clientId,
      "sourceChunkIds": ["uuid", ...] (optional fallback),
      "sourcePassages": [{ "chunkId": "uuid", "quote": "verbatim quote from that chunk" }],
      "body": {
        "kind": "character"|"location"|"faction"|"generic",
        "...kindFields": "see rules below"
      },
      "ingestionSignals": {
        "salienceRole": optional "crunch"|"flavor"|"plot_hook"|"table_advice"|"mixed",
        "voiceReliability": optional "in_world_document"|"narrator"|"gm_note"|"player_knowledge"|"unknown",
        "importance": optional number 0-1
      },
      "campaignEpoch": optional integer session/arc number,
      "loreHistorical": optional boolean if content is explicitly past/superseded in the source
    }
  ],
  "links": [
    {
      "fromClientId": "note clientId",
      "toClientId": "note clientId",
      "linkType": ${IMPORT_LINK_TYPE_ENUM} (optional; default history),
      "linkIntent": "association" | "binding_hint" (optional)
    }
  ]
}

Body rules:
- Do not copy whole chunks. Include only material specifically about this card's subject.
- \`sourcePassages.quote\` must be verbatim from the referenced chunk body.
- Missing-field policy: if source does not explicitly state a field, leave it blank.
- Character body: { kind:"character", name, role?, affiliation?, affiliationFactionClientId?, nationality?, notesParagraphs:string[] }.
- \`nationality\` must be one of ${HEARTGARDEN_NATIONS.map((n) => `"${n}"`).join(", ")} or empty string.
- Location body: { kind:"location", name, context?, detail?, notesParagraphs:string[] }.
- Faction body: { kind:"faction", namePrimary, nameAccent?, recordParagraphs:string[] }.
- Generic body: { kind:"generic", paragraphs:[{ heading?, text }] }.
- If a passage belongs to multiple entities, keep the full passage on one primary card and write <=2 sentence mentions on secondary cards.

General rules:
- Use 1–12 folders max unless the document clearly needs more.
- Titles must be stable proper nouns or section names when possible.
- If the document is tiny, one folder and one note is fine.
- **Links:** Only connect two notes that share the same folderClientId (same canvas space). Never use linkType "pin" — that is reserved for user-drawn canvas threads. Use only these semantic link types: ${IMPORT_LINK_TYPE_LIST}.
- **Link type guide (for consistent generation):**
${IMPORT_LINK_TYPE_GLOSSARY}
- **Sparsity:** Do not connect every related pair. Add links only when the edge materially improves navigation/retrieval or reflects a primary relationship.
- **Containment:** If many notes are strongly interrelated within one idea, prefer folder structure over dense link meshes; add a few bridge links instead of full local cross-wiring.
- **Association vs binding:** linkIntent is optional metadata on each link. Use "association" (default) for narrative/contextual ties. Use "binding_hint" when the edge should likely map to a structured lore-card relationship.
- Keep each note focused (one topic or tight cluster) so entity kinds and link types stay accurate.`;

const MERGE_SYSTEM = `You match new imported notes to existing canvas items (candidates from search).

Return ONLY valid JSON (no markdown fence):
{
  "mergeProposals": [
    {
      "noteClientId": "string",
      "targetItemId": "uuid — MUST be copied exactly from candidates for that note",
      "strategy": "append_dated" | "append_section",
      "proposedText": "text to append to the existing note (include a dated heading line at top if append_dated)",
      "rationale": "short string"
    }
  ],
  "contradictions": [
    { "noteClientId": "optional", "summary": "string", "details": "optional string" }
  ]
}

Rules:
- Only use targetItemId values that appear in the candidates list for that noteClientId.
- If nothing matches well, omit merge proposals for that note (a new card will be created).
- Use append_dated for session-style updates; use append_section for adding a labeled subsection.
- Flag contradictions when the new text conflicts with a candidate excerpt and cannot be merged safely without human choice.`;

const CLARIFY_SYSTEM = `You help users import TTRPG / worldbuilding documents into a spatial notes app with high accuracy.

Return ONLY valid JSON (no markdown fence):
{ "clarifications": [ CLARIFICATION_ITEM, ... ] }

Each CLARIFICATION_ITEM must include:
- "category": "structure" | "canon_weight" | "conflict" (never "link_semantics")
- "severity": "required" when human choice materially affects correctness; "optional" for minor polish only
- "title": short question (max ~120 chars)
- "context": 1–3 sentences: say what you are unsure about and cite evidence (note titles, chunk headings, candidate titles, merge rationale). Admit uncertainty plainly. Never shame the user.
- "questionKind": "single_select" | "multi_select" | "confirm_default"
- "options": array of 2–6 objects, each with:
  - "id": short stable id (e.g. "a", "b")
  - "label": user-facing choice
  - "recommended": true on exactly one option when you have a best guess
  - "planPatchHint": ONE machine patch object (see HINT OPS below)

Optional: "relatedNoteClientIds", "relatedMergeProposalId" (uuid from payload), "relatedLink": { "fromClientId", "toClientId" }

Tone: collaborative, default-forward (always mark a recommended option when possible), bounded (one decision per item). If you cannot ground a question in the payload, omit that clarification.

HINT OPS — every planPatchHint must be exactly one of:
{ "op": "no_op" }
{ "op": "set_note_folder", "noteClientId": "<id>", "folderClientId": "<folder clientId>" | null }
{ "op": "set_ingestion_signals", "noteClientId": "<id>", "patch": { optional salienceRole, voiceReliability, importance 0-1 } }
{ "op": "set_lore_historical", "noteClientId": "<id>", "loreHistorical": true|false }
{ "op": "discard_merge_proposal", "mergeProposalId": "<uuid from mergeProposals in payload>" }

(Do not emit "assign_chunk_to_note" / "unassign_chunk" hints — those are added automatically by the server for chunk-assignment gaps.)

Rules:
- For **every contradiction** in the payload, emit at least one **required** "conflict" clarification unless the contradiction is trivial noise.
- Do **not** ask about semantic link types, relationship kinds, association vs binding, or other connection-edge choices — the importer applies defaults and users adjust links on the canvas.
- Ask **structure** when a note could belong in two folders or the folder split is uncertain.
- Ask **canon_weight** when voiceReliability is unknown/mixed but the content sounds like rules or official lore (importance / historical vs current).
- Use mergeProposalId from the payload verbatim in discard_merge_proposal hints.
- Never invent note clientIds or folder clientIds — only use ids from the payload.`;

export function extractJsonObject(raw: string): string | null {
  const t = raw.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return t.slice(start, end + 1);
}

export type OutlineLlmResult = {
  folders: {
    clientId: string;
    title: string;
    parentClientId: string | null;
  }[];
  notes: {
    clientId: string;
    title: string;
    canonicalEntityKind: CanonicalEntityKind;
    summary: string;
    folderClientId: string | null;
    sourceChunkIds: string[];
    sourcePassages: { chunkId: string; quote: string }[];
    body?: LoreImportStructuredBody;
    ingestionSignals?: IngestionSignals;
    campaignEpoch?: number;
    loreHistorical?: boolean;
  }[];
  links: {
    fromClientId: string;
    toClientId: string;
    linkType?: string;
    linkIntent?: "association" | "binding_hint";
  }[];
};

/** Shrink per-chunk excerpts until the full chunk id list fits in the outline prompt. */
export function buildOutlineChunkListPayload(
  chunks: SourceTextChunk[],
): { id: string; heading: string; excerpt: string }[] {
  const MIN_EXCERPT = 80;
  const MAX_EXCERPT = 1800;
  let excerptCap = MAX_EXCERPT;
  for (let attempt = 0; attempt < 14; attempt++) {
    const list = chunks.map((c) => ({
      id: c.id,
      heading: c.heading,
      excerpt: c.body.slice(0, excerptCap),
    }));
    if (JSON.stringify(list).length <= OUTLINE_CHUNK_LIST_JSON_MAX) return list;
    excerptCap = Math.max(MIN_EXCERPT, Math.floor(excerptCap * 0.62));
  }
  return chunks.map((c) => ({
    id: c.id,
    heading: c.heading,
    excerpt: c.body.slice(0, MIN_EXCERPT),
  }));
}

function toParagraphs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .slice(0, 400);
}

function parseStructuredBody(
  canonicalEntityKind: CanonicalEntityKind,
  rawBody: unknown,
): LoreImportStructuredBody | undefined {
  if (!rawBody || typeof rawBody !== "object") return undefined;
  const o = rawBody as Record<string, unknown>;
  const expectedKind: LoreImportStructuredBody["kind"] =
    canonicalEntityKind === "npc"
      ? "character"
      : canonicalEntityKind === "location"
        ? "location"
        : canonicalEntityKind === "faction"
          ? "faction"
          : "generic";
  const rawKind = String(o.kind ?? "").trim();
  const effectiveKind =
    rawKind === "character" || rawKind === "location" || rawKind === "faction" || rawKind === "generic"
      ? rawKind
      : expectedKind;
  if (effectiveKind !== expectedKind && effectiveKind !== "generic") {
    return undefined;
  }
  if (effectiveKind === "character") {
    const nationalityRaw = String(o.nationality ?? "").trim();
    const result: Extract<LoreImportStructuredBody, { kind: "character" }> = {
      kind: "character",
      name: String(o.name ?? "").trim().slice(0, 255),
      role: String(o.role ?? "").trim().slice(0, 255) || undefined,
      affiliation: String(o.affiliation ?? "").trim().slice(0, 255) || undefined,
      affiliationFactionClientId:
        String(o.affiliationFactionClientId ?? "").trim().slice(0, 64) || undefined,
      nationality:
        nationalityRaw.length === 0 || isHeartgardenNation(nationalityRaw)
          ? nationalityRaw
          : "",
      notesParagraphs: toParagraphs(o.notesParagraphs),
    };
    const hasSignal =
      result.name.length > 0 ||
      Boolean(result.role) ||
      Boolean(result.affiliation) ||
      Boolean(result.nationality) ||
      result.notesParagraphs.length > 0;
    return hasSignal ? result : undefined;
  }
  if (effectiveKind === "location") {
    const result: Extract<LoreImportStructuredBody, { kind: "location" }> = {
      kind: "location",
      name: String(o.name ?? "").trim().slice(0, 255),
      context: String(o.context ?? "").trim().slice(0, 255) || undefined,
      detail: String(o.detail ?? "").trim().slice(0, 255) || undefined,
      notesParagraphs: toParagraphs(o.notesParagraphs),
    };
    const hasSignal =
      result.name.length > 0 ||
      Boolean(result.context) ||
      Boolean(result.detail) ||
      result.notesParagraphs.length > 0;
    return hasSignal ? result : undefined;
  }
  if (effectiveKind === "faction") {
    const result: Extract<LoreImportStructuredBody, { kind: "faction" }> = {
      kind: "faction",
      namePrimary: String(o.namePrimary ?? o.name ?? "").trim().slice(0, 255),
      nameAccent: String(o.nameAccent ?? "").trim().slice(0, 255) || undefined,
      recordParagraphs: toParagraphs(o.recordParagraphs),
    };
    const hasSignal =
      result.namePrimary.length > 0 ||
      Boolean(result.nameAccent) ||
      result.recordParagraphs.length > 0;
    return hasSignal ? result : undefined;
  }
  const rawParagraphs = Array.isArray(o.paragraphs) ? o.paragraphs : [];
  const paragraphs = rawParagraphs
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      const po = p as Record<string, unknown>;
      const text = String(po.text ?? "").trim();
      if (!text) return null;
      const heading = String(po.heading ?? "").trim();
      return {
        ...(heading ? { heading: heading.slice(0, 255) } : {}),
        text: text.slice(0, 8_000),
      };
    })
    .filter((p): p is { heading?: string; text: string } => Boolean(p))
    .slice(0, 400);
  return paragraphs.length > 0 ? { kind: "generic", paragraphs } : undefined;
}

export async function runLoreImportOutlineLlm(
  apiKey: string,
  model: string,
  chunks: SourceTextChunk[],
  sourceSample: string,
): Promise<OutlineLlmResult> {
  const chunkList = buildOutlineChunkListPayload(chunks);
  const user = `CHUNK LIST (JSON):\n${JSON.stringify(chunkList)}\n\nSOURCE SAMPLE (first ~${OUTLINE_SOURCE_SAMPLE_MAX} chars, for tone — chunk ids above are authoritative for assignment):\n${sourceSample.slice(0, OUTLINE_SOURCE_SAMPLE_MAX)}`;

  const res = await callAnthropic(
    apiKey,
    {
      model,
      system: buildCachedSystem(OUTLINE_SYSTEM),
      messages: [{ role: "user", content: user }],
    },
    { label: "lore.import.outline", expectJson: true },
  );
  const jsonStr = res.jsonText;
  if (!jsonStr) {
    return { folders: [], notes: [], links: [] };
  }
  try {
    const parsed = JSON.parse(jsonStr) as {
      folders?: unknown[];
      notes?: unknown[];
      links?: unknown[];
    };
    const folders: OutlineLlmResult["folders"] = [];
    for (const f of parsed.folders ?? []) {
      if (!f || typeof f !== "object") continue;
      const o = f as Record<string, unknown>;
      const clientId = String(o.clientId ?? "").trim();
      const title = String(o.title ?? "").trim();
      if (!clientId || !title) continue;
      const parentRaw = o.parentClientId;
      folders.push({
        clientId,
        title: title.slice(0, 255),
        parentClientId:
          parentRaw === null || parentRaw === undefined
            ? null
            : String(parentRaw).trim() || null,
      });
    }
    const notes: OutlineLlmResult["notes"] = [];
    for (const n of parsed.notes ?? []) {
      if (!n || typeof n !== "object") continue;
      const o = n as Record<string, unknown>;
      const clientId = String(o.clientId ?? "").trim();
      const title = String(o.title ?? "").trim();
      if (!clientId || !title) continue;
      const idsRaw = o.sourceChunkIds;
      const sourceChunkIds = Array.isArray(idsRaw)
        ? idsRaw.map((x) => String(x)).filter(Boolean)
        : [];
      const sourcePassagesRaw = Array.isArray(o.sourcePassages) ? o.sourcePassages : [];
      const sourcePassages = sourcePassagesRaw
        .map((sp) => {
          if (!sp || typeof sp !== "object") return null;
          const so = sp as Record<string, unknown>;
          const chunkId = String(so.chunkId ?? "").trim();
          const quote = String(so.quote ?? "").trim();
          if (!chunkId || !quote) return null;
          return { chunkId, quote: quote.slice(0, 4000) };
        })
        .filter((p): p is { chunkId: string; quote: string } => Boolean(p))
        .slice(0, 400);
      const canonicalEntityKind = normalizeCanonicalEntityKind(String(o.canonicalEntityKind));
      notes.push({
        clientId,
        title: title.slice(0, 255),
        canonicalEntityKind,
        summary: String(o.summary ?? "").slice(0, 4000),
        folderClientId:
          o.folderClientId === null || o.folderClientId === undefined
            ? null
            : String(o.folderClientId).trim() || null,
        sourceChunkIds,
        sourcePassages,
        body: parseStructuredBody(canonicalEntityKind, o.body),
        ingestionSignals:
          o.ingestionSignals && typeof o.ingestionSignals === "object"
            ? (o.ingestionSignals as IngestionSignals)
            : undefined,
        campaignEpoch:
          typeof o.campaignEpoch === "number" && Number.isFinite(o.campaignEpoch)
            ? Math.floor(o.campaignEpoch)
            : undefined,
        loreHistorical: typeof o.loreHistorical === "boolean" ? o.loreHistorical : undefined,
      });
    }
    const links: OutlineLlmResult["links"] = [];
    for (const l of parsed.links ?? []) {
      if (!l || typeof l !== "object") continue;
      const o = l as Record<string, unknown>;
      const fromClientId = String(o.fromClientId ?? "").trim();
      const toClientId = String(o.toClientId ?? "").trim();
      if (!fromClientId || !toClientId) continue;
      links.push({
        fromClientId,
        toClientId,
        linkType: o.linkType != null ? String(o.linkType).slice(0, 64) : undefined,
        linkIntent:
          o.linkIntent === "association" || o.linkIntent === "binding_hint"
            ? o.linkIntent
            : undefined,
      });
    }
    return { folders, notes, links };
  } catch {
    return { folders: [], notes: [], links: [] };
  }
}

export type ChunkAssignmentDiagnostics = {
  /** Chunks not referenced by any note's sourceChunkIds (valid id + unassigned). */
  unassignedChunkIds: string[];
  /** Note clientIds that resolved zero valid chunks. */
  noteClientIdsWithoutChunks: string[];
  /** chunkId -> list of note clientIds that claim it when >1. */
  duplicateAssignments: { chunkId: string; noteClientIds: string[] }[];
  /** Note bodies whose quoted grounding passages all failed verification. */
  noteClientIdsWithoutGrounding: string[];
  /** Duplicate quoted passages across notes (normalized text). */
  duplicateQuotePassages: { quote: string; noteClientIds: string[] }[];
};

function buildFallbackBodyFromChunks(
  sourceChunkIds: string[],
  chunkById: ReadonlyMap<string, SourceTextChunk>,
): string {
  const bodies: string[] = [];
  for (const cid of sourceChunkIds) {
    const ch = chunkById.get(cid);
    if (ch) bodies.push(`## ${ch.heading}\n\n${ch.body}`);
  }
  if (bodies.length === 0) return "";
  return bodies.join("\n\n---\n\n").slice(0, 120_000);
}

export function renderStructuredBodyPlainText(body: LoreImportStructuredBody | undefined): string {
  if (!body) return "";
  if (body.kind === "generic") {
    return body.paragraphs
      .map((p) => `${p.heading ? `## ${p.heading}\n\n` : ""}${p.text}`)
      .join("\n\n")
      .slice(0, 120_000);
  }
  if (body.kind === "character") {
    const lines: string[] = [];
    if (body.name.trim()) lines.push(`Name: ${body.name.trim()}`);
    if (body.role?.trim()) lines.push(`Role: ${body.role.trim()}`);
    if (body.affiliation?.trim()) lines.push(`Affiliation: ${body.affiliation.trim()}`);
    if (body.nationality?.trim()) lines.push(`Nationality: ${body.nationality.trim()}`);
    if (body.notesParagraphs.length > 0) {
      lines.push("", "Notes:", ...body.notesParagraphs.map((p) => p.trim()).filter(Boolean));
    }
    return lines.join("\n").slice(0, 120_000);
  }
  if (body.kind === "location") {
    const lines: string[] = [];
    if (body.name.trim()) lines.push(`Place: ${body.name.trim()}`);
    if (body.context?.trim()) lines.push(`Context: ${body.context.trim()}`);
    if (body.detail?.trim()) lines.push(`Detail: ${body.detail.trim()}`);
    if (body.notesParagraphs.length > 0) {
      lines.push("", "Notes:", ...body.notesParagraphs.map((p) => p.trim()).filter(Boolean));
    }
    return lines.join("\n").slice(0, 120_000);
  }
  const lines: string[] = [];
  if (body.namePrimary.trim()) lines.push(`Organization: ${body.namePrimary.trim()}`);
  if (body.nameAccent?.trim()) lines.push(`Alias: ${body.nameAccent.trim()}`);
  if (body.recordParagraphs.length > 0) {
    lines.push("", "Record:", ...body.recordParagraphs.map((p) => p.trim()).filter(Boolean));
  }
  return lines.join("\n").slice(0, 120_000);
}

export function attachBodiesToOutline(
  outline: OutlineLlmResult,
  chunks: SourceTextChunk[],
): ChunkAssignmentDiagnostics {
  const notes = outline.notes;
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const assignedTo = new Map<string, string[]>();

  for (const n of notes) {
    for (const cid of n.sourceChunkIds) {
      if (!byId.has(cid)) continue;
      const list = assignedTo.get(cid) ?? [];
      list.push(n.clientId);
      assignedTo.set(cid, list);
    }
  }

  const diagnostics: ChunkAssignmentDiagnostics = {
    unassignedChunkIds: [],
    noteClientIdsWithoutChunks: [],
    duplicateAssignments: [],
    noteClientIdsWithoutGrounding: [],
    duplicateQuotePassages: [],
  };

  for (const ch of chunks) {
    if (!assignedTo.has(ch.id)) diagnostics.unassignedChunkIds.push(ch.id);
  }
  for (const [chunkId, noteClientIds] of assignedTo.entries()) {
    if (noteClientIds.length > 1) {
      diagnostics.duplicateAssignments.push({ chunkId, noteClientIds });
    }
  }

  for (const n of notes) {
    const bodyTextFromChunks = buildFallbackBodyFromChunks(n.sourceChunkIds, byId);
    if (!n.body) {
      const genericParagraphs = bodyTextFromChunks
        .split(/\n{2,}/)
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text) => ({ text: text.slice(0, 8_000) }))
        .slice(0, 400);
      n.body = { kind: "generic", paragraphs: genericParagraphs };
    }
    if (!n.sourcePassages || n.sourcePassages.length === 0) {
      n.sourcePassages = n.sourceChunkIds
        .map((id) => byId.get(id))
        .filter((ch): ch is SourceTextChunk => Boolean(ch))
        .map((ch) => ({
          chunkId: ch.id,
          quote: ch.body.slice(0, 280).trim(),
        }))
        .filter((sp) => sp.quote.length > 0);
    }
    const validPassages = (n.sourcePassages ?? []).filter((sp) => {
      const ch = byId.get(sp.chunkId);
      if (!ch) return false;
      return ch.body.includes(sp.quote);
    });
    n.sourcePassages = validPassages;
    if (validPassages.length === 0) {
      diagnostics.noteClientIdsWithoutGrounding.push(n.clientId);
    }
    const renderedBody = renderStructuredBodyPlainText(n.body);
    (n as { bodyText?: string }).bodyText = (renderedBody || bodyTextFromChunks).slice(0, 120_000);
    const groundedCount = n.sourceChunkIds.filter((id) => byId.has(id)).length;
    if (chunks.length > 0 && groundedCount === 0) {
      diagnostics.noteClientIdsWithoutChunks.push(n.clientId);
    }
  }
  const byQuote = new Map<string, string[]>();
  const sampleByQuote = new Map<string, string>();
  for (const n of notes) {
    for (const sp of n.sourcePassages ?? []) {
      const key = sp.quote.replace(/\s+/g, " ").trim().toLowerCase();
      if (!key) continue;
      const list = byQuote.get(key) ?? [];
      if (!list.includes(n.clientId)) list.push(n.clientId);
      byQuote.set(key, list);
      if (!sampleByQuote.has(key)) {
        sampleByQuote.set(key, sp.quote.replace(/\s+/g, " ").trim());
      }
    }
  }
  for (const [quote, noteClientIds] of byQuote.entries()) {
    if (noteClientIds.length > 1) {
      diagnostics.duplicateQuotePassages.push({
        quote: (sampleByQuote.get(quote) ?? quote).slice(0, 280),
        noteClientIds,
      });
    }
  }

  return diagnostics;
}

/** Back-compat wrapper retained for tests and legacy call sites. */
export function fillNoteBodiesFromChunks(
  notes: OutlineLlmResult["notes"],
  chunks: SourceTextChunk[],
): ChunkAssignmentDiagnostics {
  return attachBodiesToOutline({ folders: [], notes, links: [] }, chunks);
}

export type CandidateRow = {
  itemId: string;
  title: string;
  spaceName: string;
  snippet?: string;
  itemType?: string;
  entityType?: string | null;
};

export async function runLoreImportMergeLlm(
  apiKey: string,
  model: string,
  notes: { clientId: string; title: string; summary: string; bodyPreview: string }[],
  candidatesByNoteClientId: Record<string, CandidateRow[]>,
): Promise<{
  mergeProposals: {
    noteClientId: string;
    targetItemId: string;
    strategy: "append_dated" | "append_section";
    proposedText: string;
    rationale?: string;
  }[];
  contradictions: { noteClientId?: string; summary: string; details?: string }[];
}> {
  const payload = notes.map((n) => ({
    noteClientId: n.clientId,
    title: n.title,
    summary: n.summary,
    bodyPreview: n.bodyPreview,
    candidates: candidatesByNoteClientId[n.clientId] ?? [],
  }));
  const user = `NOTES AND CANDIDATES (JSON):\n${JSON.stringify(payload).slice(0, MERGE_USER_JSON_MAX)}`;

  const res = await callAnthropic(
    apiKey,
    {
      model,
      system: buildCachedSystem(MERGE_SYSTEM),
      messages: [{ role: "user", content: user }],
    },
    { label: "lore.import.merge", expectJson: true },
  );
  const jsonStr = res.jsonText;
  if (!jsonStr) {
    return { mergeProposals: [], contradictions: [] };
  }
  try {
    const parsed = JSON.parse(jsonStr) as {
      mergeProposals?: unknown[];
      contradictions?: unknown[];
    };
    const mergeProposals: {
      noteClientId: string;
      targetItemId: string;
      strategy: "append_dated" | "append_section";
      proposedText: string;
      rationale?: string;
    }[] = [];
    for (const m of parsed.mergeProposals ?? []) {
      if (!m || typeof m !== "object") continue;
      const o = m as Record<string, unknown>;
      const noteClientId = String(o.noteClientId ?? "").trim();
      const targetItemId = String(o.targetItemId ?? "").trim();
      const strategy = o.strategy === "append_section" ? "append_section" : "append_dated";
      const proposedText = String(o.proposedText ?? "").slice(0, 120_000);
      if (!noteClientId || !targetItemId || !proposedText) continue;
      const allowed = new Set(
        (candidatesByNoteClientId[noteClientId] ?? []).map((c) => c.itemId),
      );
      if (!allowed.has(targetItemId)) continue;
      mergeProposals.push({
        noteClientId,
        targetItemId,
        strategy,
        proposedText,
        rationale: o.rationale != null ? String(o.rationale).slice(0, 2000) : undefined,
      });
    }
    const contradictions: { noteClientId?: string; summary: string; details?: string }[] = [];
    for (const c of parsed.contradictions ?? []) {
      if (!c || typeof c !== "object") continue;
      const o = c as Record<string, unknown>;
      const summary = String(o.summary ?? "").trim();
      if (!summary) continue;
      contradictions.push({
        noteClientId: o.noteClientId != null ? String(o.noteClientId).trim() : undefined,
        summary: summary.slice(0, 2000),
        details: o.details != null ? String(o.details).slice(0, 8000) : undefined,
      });
    }
    return { mergeProposals, contradictions };
  } catch {
    return { mergeProposals: [], contradictions: [] };
  }
}

const MERGE_NOTE_BATCH = 10;

/** Long imports produce many notes; one merge call can exceed context — run in batches. */
export async function runLoreImportMergeLlmBatched(
  apiKey: string,
  model: string,
  mergeInput: {
    clientId: string;
    title: string;
    summary: string;
    bodyPreview: string;
  }[],
  candidatesByNoteClientId: Record<string, CandidateRow[]>,
  onBatchProgress?: (step: number, total: number) => void | Promise<void>,
): Promise<{
  mergeProposals: {
    noteClientId: string;
    targetItemId: string;
    strategy: "append_dated" | "append_section";
    proposedText: string;
    rationale?: string;
  }[];
  contradictions: { noteClientId?: string; summary: string; details?: string }[];
}> {
  const mergeProposals: {
    noteClientId: string;
    targetItemId: string;
    strategy: "append_dated" | "append_section";
    proposedText: string;
    rationale?: string;
  }[] = [];
  const contradictions: {
    noteClientId?: string;
    summary: string;
    details?: string;
  }[] = [];
  const totalBatches = Math.max(1, Math.ceil(mergeInput.length / MERGE_NOTE_BATCH));
  for (let i = 0; i < mergeInput.length; i += MERGE_NOTE_BATCH) {
    const batchStep = Math.floor(i / MERGE_NOTE_BATCH) + 1;
    await onBatchProgress?.(batchStep, totalBatches);
    const batch = mergeInput.slice(i, i + MERGE_NOTE_BATCH);
    const cand: Record<string, CandidateRow[]> = {};
    for (const n of batch) {
      cand[n.clientId] = candidatesByNoteClientId[n.clientId] ?? [];
    }
    const r = await runLoreImportMergeLlm(apiKey, model, batch, cand);
    mergeProposals.push(...r.mergeProposals);
    contradictions.push(...r.contradictions);
  }
  return { mergeProposals, contradictions };
}

export type LoreImportClarifyContext = {
  folders: {
    clientId: string;
    title: string;
    parentClientId: string | null | undefined;
  }[];
  notes: {
    clientId: string;
    title: string;
    summary: string;
    folderClientId: string | null;
    canonicalEntityKind?: string;
    ingestionSignals?: IngestionSignals;
    loreHistorical?: boolean;
  }[];
  links: {
    fromClientId: string;
    toClientId: string;
    linkType?: string;
    linkIntent?: "association" | "binding_hint";
  }[];
  mergeProposals: {
    id: string;
    noteClientId: string;
    targetItemId: string;
    targetTitle: string;
    strategy: string;
    rationale?: string;
  }[];
  contradictions: {
    id: string;
    noteClientId?: string;
    summary: string;
    details?: string;
  }[];
  chunks: { id: string; heading: string; excerpt: string }[];
};

export async function runLoreImportClarifyLlm(
  apiKey: string,
  model: string,
  context: LoreImportClarifyContext,
): Promise<unknown[]> {
  const user = `IMPORT PLAN CONTEXT (JSON):\n${JSON.stringify(context).slice(0, CLARIFY_USER_JSON_MAX)}`;
  const res = await callAnthropic(
    apiKey,
    {
      model,
      system: buildCachedSystem(CLARIFY_SYSTEM),
      messages: [{ role: "user", content: user }],
    },
    { label: "lore.import.clarify", expectJson: true },
  );
  const jsonStr = res.jsonText;
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr) as { clarifications?: unknown[] };
    return Array.isArray(parsed.clarifications) ? parsed.clarifications : [];
  } catch {
    return [];
  }
}

export function ensureOutlineHasFallbackNote(outline: OutlineLlmResult, chunks: SourceTextChunk[]): void {
  if (outline.notes.length > 0 || chunks.length === 0) return;
  outline.notes.push({
    clientId: "n_fallback",
    title: chunks[0]!.heading.slice(0, 255) || "Imported document",
    canonicalEntityKind: "lore",
    summary: "Auto-generated from source chunks.",
    folderClientId: null,
    sourceChunkIds: chunks.map((c) => c.id),
    sourcePassages: chunks.slice(0, 6).map((c) => ({ chunkId: c.id, quote: c.body.slice(0, 280) })),
    body: {
      kind: "generic",
      paragraphs: chunks.slice(0, 12).map((c) => ({
        heading: c.heading.slice(0, 255),
        text: c.body.slice(0, 8_000),
      })),
    },
  });
}
