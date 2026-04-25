import { buildCachedSystem, callAnthropic } from "@/src/lib/anthropic-client";
import {
  CANONICAL_RELATIONSHIP_LINK_TYPES,
  connectionKindsPromptGlossary,
} from "@/src/lib/connection-kind-colors";
import {
  type HgStructuredBlock,
  hgStructuredBlockSchema,
} from "@/src/lib/hg-doc/structured-body";
import { HG_HEADING_GUIDANCE_PROMPT } from "@/src/lib/hg-doc/structured-body-heuristics";
import { markdownToStructuredBody } from "@/src/lib/hg-doc/structured-body-to-hg-doc";
import {
  type CanonicalEntityKind,
  normalizeCanonicalEntityKind,
} from "@/src/lib/lore-import-canonical-kinds";
import type { SourceTextChunk } from "@/src/lib/lore-import-chunk";
import type {
  IngestionSignals,
  LoreImportStructuredBody,
  LoreImportUserContext,
} from "@/src/lib/lore-import-plan-types";
import { trimLocationTopFieldForImport } from "@/src/lib/lore-location-focus-document-html";
import {
  HEARTGARDEN_NATIONS,
  isHeartgardenNation,
} from "@/src/lib/lore-nations";

/** Keep chunk list JSON under this so long docs still send every chunk id to the model. */
export const OUTLINE_CHUNK_LIST_JSON_MAX = 650_000;
const OUTLINE_SOURCE_SAMPLE_MAX = 400_000;
/** Merge / clarify payloads can be large when many notes exist; batch merge separately. */
const MERGE_USER_JSON_MAX = 420_000;
const CLARIFY_USER_JSON_MAX = 420_000;
const IMPORT_LINK_TYPE_ENUM = CANONICAL_RELATIONSHIP_LINK_TYPES.map(
  (t) => `"${t}"`
).join("|");
const IMPORT_LINK_TYPE_LIST = CANONICAL_RELATIONSHIP_LINK_TYPES.join(", ");
const IMPORT_LINK_TYPE_GLOSSARY = connectionKindsPromptGlossary();
const LORE_IMPORT_RESPONSE_SNIPPET_MAX = 2000;

export interface LoreImportLlmCallEvent {
  durationMs?: number;
  inputTokens?: number | null;
  label: string;
  model: string;
  outputTokens?: number | null;
  responseSnippet?: string;
  stopReason?: string | null;
}

type LoreImportLlmCallReporter = (
  event: LoreImportLlmCallEvent
) => void | Promise<void>;

function coerceOptionalNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.trunc(value);
}

function clipResponseSnippet(text: string): string | undefined {
  const normalized = String(text ?? "").trim();
  if (!normalized) {
    return;
  }
  if (normalized.length <= LORE_IMPORT_RESPONSE_SNIPPET_MAX) {
    return normalized;
  }
  return `${normalized.slice(0, LORE_IMPORT_RESPONSE_SNIPPET_MAX)}...`;
}

async function emitLlmCall(
  onLlmCall: LoreImportLlmCallReporter | undefined,
  event: LoreImportLlmCallEvent
): Promise<void> {
  if (!onLlmCall) {
    return;
  }
  await onLlmCall(event);
}

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
- Generic body: { kind:"generic", blocks:[{ kind:"heading", level:1|2|3, text } | { kind:"paragraph", text } | { kind:"bullet_list", items:string[] } | { kind:"ordered_list", items:string[] } | { kind:"quote", text } | { kind:"hr" }] }.
- The first generic block should be a level-1 heading that matches the note title.
- ${HG_HEADING_GUIDANCE_PROMPT}
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
  ],
  "targetSpaces": [
    {
      "noteClientId": "string",
      "targetSpaceId": "uuid from allowed spaceCandidates for that note, or null for current space",
      "confidence": "number 0..1 (optional)",
      "reason": "short rationale"
    }
  ]
}

Rules:
- Only use targetItemId values that appear in the candidates list for that noteClientId.
- Only use targetSpaceId values that appear in that note's spaceCandidates list; otherwise return null.
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
  if (start < 0 || end <= start) {
    return null;
  }
  return t.slice(start, end + 1);
}

export interface OutlineLlmResult {
  folders: {
    clientId: string;
    title: string;
    parentClientId: string | null;
  }[];
  links: {
    fromClientId: string;
    toClientId: string;
    linkType?: string;
    linkIntent?: "association" | "binding_hint";
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
}

/** Shrink per-chunk excerpts until the full chunk id list fits in the outline prompt. */
export function buildOutlineChunkListPayload(
  chunks: SourceTextChunk[]
): { id: string; heading: string; excerpt: string }[] {
  const MIN_EXCERPT = 80;
  const MAX_EXCERPT = 1800;
  let excerptCap = MAX_EXCERPT;
  for (let attempt = 0; attempt < 14; attempt++) {
    const list = chunks.map((c) => ({
      excerpt: c.body.slice(0, excerptCap),
      heading: c.heading,
      id: c.id,
    }));
    if (JSON.stringify(list).length <= OUTLINE_CHUNK_LIST_JSON_MAX) {
      return list;
    }
    excerptCap = Math.max(MIN_EXCERPT, Math.floor(excerptCap * 0.62));
  }
  return chunks.map((c) => ({
    excerpt: c.body.slice(0, MIN_EXCERPT),
    heading: c.heading,
    id: c.id,
  }));
}

function toParagraphs(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .slice(0, 400);
}

function parseGenericBlocks(raw: unknown): HgStructuredBlock[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: HgStructuredBlock[] = [];
  for (const candidate of raw) {
    const parsed = hgStructuredBlockSchema.safeParse(candidate);
    if (!parsed.success) {
      continue;
    }
    out.push(parsed.data);
    if (out.length >= 400) {
      break;
    }
  }
  return out;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: structured body parser validates raw LLM JSON per canonical entity kind into the typed lore import body shape
function parseStructuredBody(
  canonicalEntityKind: CanonicalEntityKind,
  rawBody: unknown
): LoreImportStructuredBody | undefined {
  if (!rawBody || typeof rawBody !== "object") {
    return;
  }
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
    rawKind === "character" ||
    rawKind === "location" ||
    rawKind === "faction" ||
    rawKind === "generic"
      ? rawKind
      : expectedKind;
  if (effectiveKind !== expectedKind && effectiveKind !== "generic") {
    return;
  }
  if (effectiveKind === "character") {
    const nationalityRaw = String(o.nationality ?? "").trim();
    const nationality: Extract<
      LoreImportStructuredBody,
      { kind: "character" }
    >["nationality"] = isHeartgardenNation(nationalityRaw)
      ? nationalityRaw
      : "";
    const result: Extract<LoreImportStructuredBody, { kind: "character" }> = {
      affiliation:
        String(o.affiliation ?? "")
          .trim()
          .slice(0, 255) || undefined,
      affiliationFactionClientId:
        String(o.affiliationFactionClientId ?? "")
          .trim()
          .slice(0, 64) || undefined,
      kind: "character",
      name: String(o.name ?? "")
        .trim()
        .slice(0, 255),
      nationality,
      notesParagraphs: toParagraphs(o.notesParagraphs),
      role:
        String(o.role ?? "")
          .trim()
          .slice(0, 255) || undefined,
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
    const nameTrim = trimLocationTopFieldForImport(
      "name",
      String(o.name ?? "")
    );
    const contextTrim = trimLocationTopFieldForImport(
      "context",
      String(o.context ?? "")
    );
    const detailTrim = trimLocationTopFieldForImport(
      "detail",
      String(o.detail ?? "")
    );
    const trimmedFields: Array<"name" | "context" | "detail"> = [];
    if (nameTrim.wasTrimmed) {
      trimmedFields.push("name");
    }
    if (contextTrim.wasTrimmed) {
      trimmedFields.push("context");
    }
    if (detailTrim.wasTrimmed) {
      trimmedFields.push("detail");
    }
    const result: Extract<LoreImportStructuredBody, { kind: "location" }> = {
      context: contextTrim.value || undefined,
      detail: detailTrim.value || undefined,
      kind: "location",
      name: nameTrim.value,
      notesParagraphs: toParagraphs(o.notesParagraphs),
    };
    if (trimmedFields.length > 0) {
      (
        result as Extract<LoreImportStructuredBody, { kind: "location" }> & {
          __locationTopFieldTrimmedFields?: Array<
            "name" | "context" | "detail"
          >;
        }
      ).__locationTopFieldTrimmedFields = trimmedFields;
    }
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
      nameAccent:
        String(o.nameAccent ?? "")
          .trim()
          .slice(0, 255) || undefined,
      namePrimary: String(o.namePrimary ?? o.name ?? "")
        .trim()
        .slice(0, 255),
      recordParagraphs: toParagraphs(o.recordParagraphs),
    };
    const hasSignal =
      result.namePrimary.length > 0 ||
      Boolean(result.nameAccent) ||
      result.recordParagraphs.length > 0;
    return hasSignal ? result : undefined;
  }
  const blocks = parseGenericBlocks(o.blocks);
  if (blocks.length > 0) {
    return { blocks, kind: "generic" };
  }
  const fallbackText = String(o.text ?? "").trim();
  if (!fallbackText) {
    return;
  }
  return {
    blocks: markdownToStructuredBody(fallbackText, { requireH1: false }).blocks,
    kind: "generic",
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: outline LLM call assembles chunk payload, runs Anthropic with retry/continuation, and parses outline notes from streamed JSON
export async function runLoreImportOutlineLlm(
  apiKey: string,
  model: string,
  chunks: SourceTextChunk[],
  sourceSample: string,
  userContext?: LoreImportUserContext,
  onLlmCall?: LoreImportLlmCallReporter
): Promise<OutlineLlmResult> {
  const chunkList = buildOutlineChunkListPayload(chunks);
  const userIntentBlocks: string[] = [];
  const freeformContext = userContext?.freeformContext?.trim();
  if (freeformContext) {
    userIntentBlocks.push(
      `USER IMPORT INTENT:\n${freeformContext.slice(0, 4000)}`
    );
  }
  if (userContext?.orgMode === "nearby") {
    userIntentBlocks.push(
      "LAYOUT CONSTRAINT:\nReturn no folders. Every note must have folderClientId: null."
    );
  }
  const user = `${userIntentBlocks.length > 0 ? `${userIntentBlocks.join("\n\n")}\n\n` : ""}CHUNK LIST (JSON):\n${JSON.stringify(chunkList)}\n\nSOURCE SAMPLE (first ~${OUTLINE_SOURCE_SAMPLE_MAX} chars, for tone — chunk ids above are authoritative for assignment):\n${sourceSample.slice(0, OUTLINE_SOURCE_SAMPLE_MAX)}`;

  const res = await callAnthropic(
    apiKey,
    {
      messages: [{ content: user, role: "user" }],
      model,
      system: buildCachedSystem(OUTLINE_SYSTEM),
    },
    { expectJson: true, label: "lore.import.outline" }
  );
  const usage =
    (res.message as unknown as { usage?: Record<string, unknown> }).usage ?? {};
  await emitLlmCall(onLlmCall, {
    durationMs: coerceOptionalNumber(res.elapsedMs) ?? undefined,
    inputTokens: coerceOptionalNumber(usage.input_tokens),
    label: "lore.import.outline",
    model,
    outputTokens: coerceOptionalNumber(usage.output_tokens),
    responseSnippet: clipResponseSnippet(res.text),
    stopReason: res.stopReason ?? null,
  });
  const jsonStr = res.jsonText;
  if (!jsonStr) {
    return { folders: [], links: [], notes: [] };
  }
  try {
    const parsed = JSON.parse(jsonStr) as {
      folders?: unknown[];
      notes?: unknown[];
      links?: unknown[];
    };
    const folders: OutlineLlmResult["folders"] = [];
    for (const f of parsed.folders ?? []) {
      if (!f || typeof f !== "object") {
        continue;
      }
      const o = f as Record<string, unknown>;
      const clientId = String(o.clientId ?? "").trim();
      const title = String(o.title ?? "").trim();
      if (!(clientId && title)) {
        continue;
      }
      const parentRaw = o.parentClientId;
      folders.push({
        clientId,
        parentClientId:
          parentRaw === null || parentRaw === undefined
            ? null
            : String(parentRaw).trim() || null,
        title: title.slice(0, 255),
      });
    }
    const notes: OutlineLlmResult["notes"] = [];
    for (const n of parsed.notes ?? []) {
      if (!n || typeof n !== "object") {
        continue;
      }
      const o = n as Record<string, unknown>;
      const clientId = String(o.clientId ?? "").trim();
      const title = String(o.title ?? "").trim();
      if (!(clientId && title)) {
        continue;
      }
      const idsRaw = o.sourceChunkIds;
      const sourceChunkIds = Array.isArray(idsRaw)
        ? idsRaw.map((x) => String(x)).filter(Boolean)
        : [];
      const sourcePassagesRaw = Array.isArray(o.sourcePassages)
        ? o.sourcePassages
        : [];
      const sourcePassages = sourcePassagesRaw
        .map((sp) => {
          if (!sp || typeof sp !== "object") {
            return null;
          }
          const so = sp as Record<string, unknown>;
          const chunkId = String(so.chunkId ?? "").trim();
          const quote = String(so.quote ?? "").trim();
          if (!(chunkId && quote)) {
            return null;
          }
          return { chunkId, quote: quote.slice(0, 4000) };
        })
        .filter((p): p is { chunkId: string; quote: string } => Boolean(p))
        .slice(0, 400);
      const canonicalEntityKind = normalizeCanonicalEntityKind(
        String(o.canonicalEntityKind)
      );
      notes.push({
        body: parseStructuredBody(canonicalEntityKind, o.body),
        campaignEpoch:
          typeof o.campaignEpoch === "number" &&
          Number.isFinite(o.campaignEpoch)
            ? Math.floor(o.campaignEpoch)
            : undefined,
        canonicalEntityKind,
        clientId,
        folderClientId:
          o.folderClientId === null || o.folderClientId === undefined
            ? null
            : String(o.folderClientId).trim() || null,
        ingestionSignals:
          o.ingestionSignals && typeof o.ingestionSignals === "object"
            ? (o.ingestionSignals as IngestionSignals)
            : undefined,
        loreHistorical:
          typeof o.loreHistorical === "boolean" ? o.loreHistorical : undefined,
        sourceChunkIds,
        sourcePassages,
        summary: String(o.summary ?? "").slice(0, 4000),
        title: title.slice(0, 255),
      });
    }
    const links: OutlineLlmResult["links"] = [];
    for (const l of parsed.links ?? []) {
      if (!l || typeof l !== "object") {
        continue;
      }
      const o = l as Record<string, unknown>;
      const fromClientId = String(o.fromClientId ?? "").trim();
      const toClientId = String(o.toClientId ?? "").trim();
      if (!(fromClientId && toClientId)) {
        continue;
      }
      links.push({
        fromClientId,
        linkIntent:
          o.linkIntent === "association" || o.linkIntent === "binding_hint"
            ? o.linkIntent
            : undefined,
        linkType:
          o.linkType == null ? undefined : String(o.linkType).slice(0, 64),
        toClientId,
      });
    }
    return { folders, links, notes };
  } catch {
    return { folders: [], links: [], notes: [] };
  }
}

export interface ChunkAssignmentDiagnostics {
  /** chunkId -> list of note clientIds that claim it when >1. */
  duplicateAssignments: { chunkId: string; noteClientIds: string[] }[];
  /** Duplicate quoted passages across notes (normalized text). */
  duplicateQuotePassages: { quote: string; noteClientIds: string[] }[];
  /** Note clientIds that resolved zero valid chunks. */
  noteClientIdsWithoutChunks: string[];
  /** Note bodies whose quoted grounding passages all failed verification. */
  noteClientIdsWithoutGrounding: string[];
  /** Chunks not referenced by any note's sourceChunkIds (valid id + unassigned). */
  unassignedChunkIds: string[];
}

function buildFallbackBodyFromChunks(
  sourceChunkIds: string[],
  chunkById: ReadonlyMap<string, SourceTextChunk>
): string {
  const bodies: string[] = [];
  for (const cid of sourceChunkIds) {
    const ch = chunkById.get(cid);
    if (ch) {
      bodies.push(`## ${ch.heading}\n\n${ch.body}`);
    }
  }
  if (bodies.length === 0) {
    return "";
  }
  return bodies.join("\n\n---\n\n").slice(0, 120_000);
}

export function renderStructuredBodyPlainText(
  body: LoreImportStructuredBody | undefined
): string {
  if (!body) {
    return "";
  }
  if (body.kind === "generic") {
    return body.blocks
      .map((block) => {
        if (block.kind === "heading") {
          return `${"#".repeat(block.level)} ${block.text}`.trim();
        }
        if (block.kind === "paragraph") {
          return block.text;
        }
        if (block.kind === "quote") {
          return `> ${block.text}`;
        }
        if (block.kind === "bullet_list") {
          return block.items.map((item) => `- ${item}`).join("\n");
        }
        if (block.kind === "ordered_list") {
          return block.items
            .map((item, idx) => `${idx + 1}. ${item}`)
            .join("\n");
        }
        return "---";
      })
      .join("\n\n")
      .slice(0, 120_000);
  }
  if (body.kind === "character") {
    const lines: string[] = [];
    if (body.name.trim()) {
      lines.push(`Name: ${body.name.trim()}`);
    }
    if (body.role?.trim()) {
      lines.push(`Role: ${body.role.trim()}`);
    }
    if (body.affiliation?.trim()) {
      lines.push(`Affiliation: ${body.affiliation.trim()}`);
    }
    if (body.nationality?.trim()) {
      lines.push(`Nationality: ${body.nationality.trim()}`);
    }
    if (body.notesParagraphs.length > 0) {
      lines.push(
        "",
        "Notes:",
        ...body.notesParagraphs.map((p) => p.trim()).filter(Boolean)
      );
    }
    return lines.join("\n").slice(0, 120_000);
  }
  if (body.kind === "location") {
    const lines: string[] = [];
    if (body.name.trim()) {
      lines.push(`Place: ${body.name.trim()}`);
    }
    if (body.context?.trim()) {
      lines.push(`Context: ${body.context.trim()}`);
    }
    if (body.detail?.trim()) {
      lines.push(`Detail: ${body.detail.trim()}`);
    }
    if (body.notesParagraphs.length > 0) {
      lines.push(
        "",
        "Notes:",
        ...body.notesParagraphs.map((p) => p.trim()).filter(Boolean)
      );
    }
    return lines.join("\n").slice(0, 120_000);
  }
  const lines: string[] = [];
  if (body.namePrimary.trim()) {
    lines.push(`Organization: ${body.namePrimary.trim()}`);
  }
  if (body.nameAccent?.trim()) {
    lines.push(`Alias: ${body.nameAccent.trim()}`);
  }
  if (body.recordParagraphs.length > 0) {
    lines.push(
      "",
      "Record:",
      ...body.recordParagraphs.map((p) => p.trim()).filter(Boolean)
    );
  }
  return lines.join("\n").slice(0, 120_000);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: outline-body attach merges chunk text per note while tracking unassigned/duplicate chunk diagnostics
export function attachBodiesToOutline(
  outline: OutlineLlmResult,
  chunks: SourceTextChunk[]
): ChunkAssignmentDiagnostics {
  const notes = outline.notes;
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const assignedTo = new Map<string, string[]>();

  for (const n of notes) {
    for (const cid of n.sourceChunkIds) {
      if (!byId.has(cid)) {
        continue;
      }
      const list = assignedTo.get(cid) ?? [];
      list.push(n.clientId);
      assignedTo.set(cid, list);
    }
  }

  const diagnostics: ChunkAssignmentDiagnostics = {
    duplicateAssignments: [],
    duplicateQuotePassages: [],
    noteClientIdsWithoutChunks: [],
    noteClientIdsWithoutGrounding: [],
    unassignedChunkIds: [],
  };

  for (const ch of chunks) {
    if (!assignedTo.has(ch.id)) {
      diagnostics.unassignedChunkIds.push(ch.id);
    }
  }
  for (const [chunkId, noteClientIds] of assignedTo.entries()) {
    if (noteClientIds.length > 1) {
      diagnostics.duplicateAssignments.push({ chunkId, noteClientIds });
    }
  }

  for (const n of notes) {
    const bodyTextFromChunks = buildFallbackBodyFromChunks(
      n.sourceChunkIds,
      byId
    );
    if (!n.body) {
      const fallbackTitle = n.title?.trim() || "Imported note";
      n.body = {
        blocks: markdownToStructuredBody(bodyTextFromChunks, {
          requireH1: true,
          title: fallbackTitle,
        }).blocks,
        kind: "generic",
      };
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
      if (!ch) {
        return false;
      }
      return ch.body.includes(sp.quote);
    });
    n.sourcePassages = validPassages;
    if (validPassages.length === 0) {
      diagnostics.noteClientIdsWithoutGrounding.push(n.clientId);
    }
    const renderedBody = renderStructuredBodyPlainText(n.body);
    (n as { bodyText?: string }).bodyText = (
      renderedBody || bodyTextFromChunks
    ).slice(0, 120_000);
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
      if (!key) {
        continue;
      }
      const list = byQuote.get(key) ?? [];
      if (!list.includes(n.clientId)) {
        list.push(n.clientId);
      }
      byQuote.set(key, list);
      if (!sampleByQuote.has(key)) {
        sampleByQuote.set(key, sp.quote.replace(/\s+/g, " ").trim());
      }
    }
  }
  for (const [quote, noteClientIds] of byQuote.entries()) {
    if (noteClientIds.length > 1) {
      diagnostics.duplicateQuotePassages.push({
        noteClientIds,
        quote: (sampleByQuote.get(quote) ?? quote).slice(0, 280),
      });
    }
  }

  return diagnostics;
}

/** Back-compat wrapper retained for tests and legacy call sites. */
export function fillNoteBodiesFromChunks(
  notes: OutlineLlmResult["notes"],
  chunks: SourceTextChunk[]
): ChunkAssignmentDiagnostics {
  return attachBodiesToOutline({ folders: [], links: [], notes }, chunks);
}

export interface CandidateRow {
  entityType?: string | null;
  itemId: string;
  itemType?: string;
  snippet?: string;
  spaceId?: string;
  spaceName: string;
  title: string;
}

export interface SpaceCandidateRow {
  path?: string;
  reason?: string;
  score?: number;
  spaceId: string;
  spaceTitle: string;
  topTitles?: string[];
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: merge-candidate LLM call validates per-note merge suggestions, dedupes, and attaches space/title hints to candidates
export async function runLoreImportMergeLlm(
  apiKey: string,
  model: string,
  notes: {
    clientId: string;
    title: string;
    summary: string;
    bodyPreview: string;
  }[],
  candidatesByNoteClientId: Record<string, CandidateRow[]>,
  spaceCandidatesByNoteClientId: Record<string, SpaceCandidateRow[]> = {},
  onLlmCall?: LoreImportLlmCallReporter
): Promise<{
  mergeProposals: {
    noteClientId: string;
    targetItemId: string;
    strategy: "append_dated" | "append_section";
    proposedText: string;
    rationale?: string;
  }[];
  contradictions: {
    noteClientId?: string;
    summary: string;
    details?: string;
  }[];
  targetSpaces: {
    noteClientId: string;
    targetSpaceId: string | null;
    confidence?: number;
    reason?: string;
  }[];
}> {
  const payload = notes.map((n) => ({
    bodyPreview: n.bodyPreview,
    candidates: candidatesByNoteClientId[n.clientId] ?? [],
    noteClientId: n.clientId,
    spaceCandidates: spaceCandidatesByNoteClientId[n.clientId] ?? [],
    summary: n.summary,
    title: n.title,
  }));
  const user = `NOTES AND CANDIDATES (JSON):\n${JSON.stringify(payload).slice(0, MERGE_USER_JSON_MAX)}`;

  const res = await callAnthropic(
    apiKey,
    {
      messages: [{ content: user, role: "user" }],
      model,
      system: buildCachedSystem(MERGE_SYSTEM),
    },
    { expectJson: true, label: "lore.import.merge" }
  );
  const usage =
    (res.message as unknown as { usage?: Record<string, unknown> }).usage ?? {};
  await emitLlmCall(onLlmCall, {
    durationMs: coerceOptionalNumber(res.elapsedMs) ?? undefined,
    inputTokens: coerceOptionalNumber(usage.input_tokens),
    label: "lore.import.merge",
    model,
    outputTokens: coerceOptionalNumber(usage.output_tokens),
    responseSnippet: clipResponseSnippet(res.text),
    stopReason: res.stopReason ?? null,
  });
  const jsonStr = res.jsonText;
  if (!jsonStr) {
    return { contradictions: [], mergeProposals: [], targetSpaces: [] };
  }
  try {
    const parsed = JSON.parse(jsonStr) as {
      mergeProposals?: unknown[];
      contradictions?: unknown[];
      targetSpaces?: unknown[];
    };
    const mergeProposals: {
      noteClientId: string;
      targetItemId: string;
      strategy: "append_dated" | "append_section";
      proposedText: string;
      rationale?: string;
    }[] = [];
    for (const m of parsed.mergeProposals ?? []) {
      if (!m || typeof m !== "object") {
        continue;
      }
      const o = m as Record<string, unknown>;
      const noteClientId = String(o.noteClientId ?? "").trim();
      const targetItemId = String(o.targetItemId ?? "").trim();
      const strategy =
        o.strategy === "append_section" ? "append_section" : "append_dated";
      const proposedText = String(o.proposedText ?? "").slice(0, 120_000);
      if (!(noteClientId && targetItemId && proposedText)) {
        continue;
      }
      const allowed = new Set(
        (candidatesByNoteClientId[noteClientId] ?? []).map((c) => c.itemId)
      );
      if (!allowed.has(targetItemId)) {
        continue;
      }
      mergeProposals.push({
        noteClientId,
        proposedText,
        rationale:
          o.rationale == null ? undefined : String(o.rationale).slice(0, 2000),
        strategy,
        targetItemId,
      });
    }
    const contradictions: {
      noteClientId?: string;
      summary: string;
      details?: string;
    }[] = [];
    for (const c of parsed.contradictions ?? []) {
      if (!c || typeof c !== "object") {
        continue;
      }
      const o = c as Record<string, unknown>;
      const summary = String(o.summary ?? "").trim();
      if (!summary) {
        continue;
      }
      contradictions.push({
        details:
          o.details == null ? undefined : String(o.details).slice(0, 8000),
        noteClientId:
          o.noteClientId == null ? undefined : String(o.noteClientId).trim(),
        summary: summary.slice(0, 2000),
      });
    }
    const targetSpaces: {
      noteClientId: string;
      targetSpaceId: string | null;
      confidence?: number;
      reason?: string;
    }[] = [];
    for (const t of parsed.targetSpaces ?? []) {
      if (!t || typeof t !== "object") {
        continue;
      }
      const o = t as Record<string, unknown>;
      const noteClientId = String(o.noteClientId ?? "").trim();
      if (!noteClientId) {
        continue;
      }
      const allowedSpaceIds = new Set(
        (spaceCandidatesByNoteClientId[noteClientId] ?? []).map(
          (c) => c.spaceId
        )
      );
      const rawTarget = o.targetSpaceId;
      const targetSpaceId =
        typeof rawTarget === "string" && allowedSpaceIds.has(rawTarget.trim())
          ? rawTarget.trim()
          : null;
      const rawConfidence =
        typeof o.confidence === "number" && Number.isFinite(o.confidence)
          ? Math.max(0, Math.min(1, o.confidence))
          : undefined;
      targetSpaces.push({
        confidence: rawConfidence,
        noteClientId,
        reason: o.reason == null ? undefined : String(o.reason).slice(0, 400),
        targetSpaceId,
      });
    }
    return { contradictions, mergeProposals, targetSpaces };
  } catch {
    return { contradictions: [], mergeProposals: [], targetSpaces: [] };
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
  spaceCandidatesByNoteClientId: Record<string, SpaceCandidateRow[]> = {},
  onBatchProgress?: (step: number, total: number) => void | Promise<void>,
  onLlmCall?: LoreImportLlmCallReporter
): Promise<{
  mergeProposals: {
    noteClientId: string;
    targetItemId: string;
    strategy: "append_dated" | "append_section";
    proposedText: string;
    rationale?: string;
  }[];
  contradictions: {
    noteClientId?: string;
    summary: string;
    details?: string;
  }[];
  targetSpaces: {
    noteClientId: string;
    targetSpaceId: string | null;
    confidence?: number;
    reason?: string;
  }[];
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
  const targetSpaces: {
    noteClientId: string;
    targetSpaceId: string | null;
    confidence?: number;
    reason?: string;
  }[] = [];
  const totalBatches = Math.max(
    1,
    Math.ceil(mergeInput.length / MERGE_NOTE_BATCH)
  );
  for (let i = 0; i < mergeInput.length; i += MERGE_NOTE_BATCH) {
    const batchStep = Math.floor(i / MERGE_NOTE_BATCH) + 1;
    await onBatchProgress?.(batchStep, totalBatches);
    const batch = mergeInput.slice(i, i + MERGE_NOTE_BATCH);
    const cand: Record<string, CandidateRow[]> = {};
    const spaceCand: Record<string, SpaceCandidateRow[]> = {};
    for (const n of batch) {
      cand[n.clientId] = candidatesByNoteClientId[n.clientId] ?? [];
      spaceCand[n.clientId] = spaceCandidatesByNoteClientId[n.clientId] ?? [];
    }
    const r = await runLoreImportMergeLlm(
      apiKey,
      model,
      batch,
      cand,
      spaceCand,
      onLlmCall
    );
    mergeProposals.push(...r.mergeProposals);
    contradictions.push(...r.contradictions);
    targetSpaces.push(...r.targetSpaces);
  }
  return { contradictions, mergeProposals, targetSpaces };
}

export interface LoreImportClarifyContext {
  chunks: { id: string; heading: string; excerpt: string }[];
  contradictions: {
    id: string;
    noteClientId?: string;
    summary: string;
    details?: string;
  }[];
  folders: {
    clientId: string;
    title: string;
    parentClientId: string | null | undefined;
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
  notes: {
    clientId: string;
    title: string;
    summary: string;
    folderClientId: string | null;
    canonicalEntityKind?: string;
    ingestionSignals?: IngestionSignals;
    loreHistorical?: boolean;
  }[];
}

export async function runLoreImportClarifyLlm(
  apiKey: string,
  model: string,
  context: LoreImportClarifyContext,
  onLlmCall?: LoreImportLlmCallReporter
): Promise<unknown[]> {
  const user = `IMPORT PLAN CONTEXT (JSON):\n${JSON.stringify(context).slice(0, CLARIFY_USER_JSON_MAX)}`;
  const res = await callAnthropic(
    apiKey,
    {
      messages: [{ content: user, role: "user" }],
      model,
      system: buildCachedSystem(CLARIFY_SYSTEM),
    },
    { expectJson: true, label: "lore.import.clarify" }
  );
  const usage =
    (res.message as unknown as { usage?: Record<string, unknown> }).usage ?? {};
  await emitLlmCall(onLlmCall, {
    durationMs: coerceOptionalNumber(res.elapsedMs) ?? undefined,
    inputTokens: coerceOptionalNumber(usage.input_tokens),
    label: "lore.import.clarify",
    model,
    outputTokens: coerceOptionalNumber(usage.output_tokens),
    responseSnippet: clipResponseSnippet(res.text),
    stopReason: res.stopReason ?? null,
  });
  const jsonStr = res.jsonText;
  if (!jsonStr) {
    return [];
  }
  try {
    const parsed = JSON.parse(jsonStr) as { clarifications?: unknown[] };
    return Array.isArray(parsed.clarifications) ? parsed.clarifications : [];
  } catch {
    return [];
  }
}

export function ensureOutlineHasFallbackNote(
  outline: OutlineLlmResult,
  chunks: SourceTextChunk[]
): void {
  if (outline.notes.length > 0 || chunks.length === 0) {
    return;
  }
  outline.notes.push({
    body: {
      blocks: markdownToStructuredBody(
        chunks
          .slice(0, 12)
          .map(
            (c) => `## ${c.heading.slice(0, 255)}\n\n${c.body.slice(0, 8000)}`
          )
          .join("\n\n"),
        {
          requireH1: true,
          title: chunks[0]?.heading.slice(0, 255) || "Imported document",
        }
      ).blocks,
      kind: "generic",
    },
    canonicalEntityKind: "lore",
    clientId: "n_fallback",
    folderClientId: null,
    sourceChunkIds: chunks.map((c) => c.id),
    sourcePassages: chunks
      .slice(0, 6)
      .map((c) => ({ chunkId: c.id, quote: c.body.slice(0, 280) })),
    summary: "Auto-generated from source chunks.",
    title: chunks[0]?.heading.slice(0, 255) || "Imported document",
  });
}
