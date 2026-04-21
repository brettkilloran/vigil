import Anthropic from "@anthropic-ai/sdk";

import { anthropicLlmDeadlineMs, withDeadline } from "@/src/lib/async-timeout";
import {
  normalizeCanonicalEntityKind,
  type CanonicalEntityKind,
} from "@/src/lib/lore-import-canonical-kinds";
import {
  CANONICAL_RELATIONSHIP_LINK_TYPES,
  connectionKindsPromptGlossary,
} from "@/src/lib/connection-kind-colors";
import type { SourceTextChunk } from "@/src/lib/lore-import-chunk";
import type { IngestionSignals } from "@/src/lib/lore-import-plan-types";

/** Keep chunk list JSON under this so long docs still send every chunk id to the model. */
export const OUTLINE_CHUNK_LIST_JSON_MAX = 650_000;
const OUTLINE_SOURCE_SAMPLE_MAX = 120_000;
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
      "sourceChunkIds": ["uuid", ...] — MUST be ids from the CHUNK LIST; pick chunks whose content belongs in this note,
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

Rules:
- Every chunk id from the list should appear in at least one note's sourceChunkIds, or be clearly redundant — prefer covering the whole document.
- Use 1–12 folders max unless the document clearly needs more.
- Titles must be stable proper nouns or section names when possible.
- If the document is tiny, one folder and one note is fine.
- **Links:** Only connect two notes that share the same folderClientId (same canvas space). Never use linkType "pin" — that is reserved for user-drawn canvas threads. Use only these semantic link types: ${IMPORT_LINK_TYPE_LIST}.
- **Link type guide (for consistent generation):**
${IMPORT_LINK_TYPE_GLOSSARY}
- **Sparsity:** Do not connect every related pair. Add links only when the edge materially improves navigation/retrieval or reflects a primary relationship.
- **Containment:** If many notes are strongly interrelated within one idea, prefer folder structure over dense link meshes; add a few bridge links instead of full local cross-wiring.
- **Association vs binding:** linkIntent is optional metadata on each link. Use "association" (default) for narrative or contextual ties that should stay as **canvas connections** (item_links rows) only. Use "binding_hint" when the edge is really a **structured relationship that belongs on a lore card** (employer faction, home location, roster membership) — the importer still creates a connection row today, but hints that the GM should confirm or fill the matching hgArch fields on the card; do not invent roster rows the document does not support.
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
- "category": "structure" | "link_semantics" | "canon_weight" | "conflict"
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
{ "op": "set_link_type", "fromClientId": "<id>", "toClientId": "<id>", "linkType": ${IMPORT_LINK_TYPE_ENUM} }
{ "op": "remove_link", "fromClientId": "<id>", "toClientId": "<id>" }
{ "op": "set_ingestion_signals", "noteClientId": "<id>", "patch": { optional salienceRole, voiceReliability, importance 0-1 } }
{ "op": "set_lore_historical", "noteClientId": "<id>", "loreHistorical": true|false }
{ "op": "discard_merge_proposal", "mergeProposalId": "<uuid from mergeProposals in payload>" }

(Do not emit "assign_chunk_to_note" / "unassign_chunk" hints — those are added automatically by the server for chunk-assignment gaps.)

Rules:
- For **every contradiction** in the payload, emit at least one **required** "conflict" clarification unless the contradiction is trivial noise.
- Ask about **link_semantics** when relationship type is ambiguous between two linked notes.
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

export async function runLoreImportOutlineLlm(
  apiKey: string,
  model: string,
  chunks: SourceTextChunk[],
  sourceSample: string,
): Promise<OutlineLlmResult> {
  const client = new Anthropic({ apiKey });
  const chunkList = buildOutlineChunkListPayload(chunks);
  const user = `CHUNK LIST (JSON):\n${JSON.stringify(chunkList)}\n\nSOURCE SAMPLE (first ~${OUTLINE_SOURCE_SAMPLE_MAX} chars, for tone — chunk ids above are authoritative for assignment):\n${sourceSample.slice(0, OUTLINE_SOURCE_SAMPLE_MAX)}`;

  const res = await withDeadline(
    client.messages.create({
      model,
      max_tokens: 8192,
      system: OUTLINE_SYSTEM,
      messages: [{ role: "user", content: user }],
    }),
    anthropicLlmDeadlineMs(),
    "lore_import_outline",
  );
  let raw = "";
  for (const block of res.content) {
    if (block.type === "text") raw += block.text;
  }
  const jsonStr = extractJsonObject(raw);
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
      notes.push({
        clientId,
        title: title.slice(0, 255),
        canonicalEntityKind: normalizeCanonicalEntityKind(String(o.canonicalEntityKind)),
        summary: String(o.summary ?? "").slice(0, 4000),
        folderClientId:
          o.folderClientId === null || o.folderClientId === undefined
            ? null
            : String(o.folderClientId).trim() || null,
        sourceChunkIds,
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

/** Placeholder body shown for notes the model created but failed to ground in any chunk. */
export const NO_MATCHING_CHUNKS_PLACEHOLDER =
  "_(No matching chunks — pick one in review, or keep this as a summary-only stub.)_";

/**
 * Diagnostics describing how chunks were distributed across notes in the outline.
 * The plan-build orchestrator turns these into `chunk_assignment` /
 * `unassigned_chunks` / `duplicate_chunk_assignment` clarifications so the user
 * can resolve gaps during review instead of silently burying content on note[0].
 *
 * @see docs/LORE_IMPORT_AUDIT_2026-04-21.md §4.4
 */
export type ChunkAssignmentDiagnostics = {
  /** Chunks not referenced by any note's sourceChunkIds (valid id + unassigned). */
  unassignedChunkIds: string[];
  /** Note clientIds that resolved zero valid chunks (placeholder body written). */
  noteClientIdsWithoutChunks: string[];
  /** chunkId -> list of note clientIds that claim it when >1. */
  duplicateAssignments: { chunkId: string; noteClientIds: string[] }[];
};

export function buildNoteBodyFromChunks(
  sourceChunkIds: string[],
  chunkById: ReadonlyMap<string, SourceTextChunk>,
): string {
  const bodies: string[] = [];
  for (const cid of sourceChunkIds) {
    const ch = chunkById.get(cid);
    if (ch) bodies.push(`## ${ch.heading}\n\n${ch.body}`);
  }
  if (bodies.length === 0) return NO_MATCHING_CHUNKS_PLACEHOLDER;
  return bodies.join("\n\n---\n\n").slice(0, 120_000);
}

/**
 * Resolve each note to a grounded `bodyText` and collect diagnostics. No longer
 * "dumps" unassigned chunks onto the first note — unclaimed content surfaces via
 * clarifications so the user consciously decides where it goes (or that it stays
 * only on the source card).
 */
export function fillNoteBodiesFromChunks(
  notes: OutlineLlmResult["notes"],
  chunks: SourceTextChunk[],
): ChunkAssignmentDiagnostics {
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
    const body = buildNoteBodyFromChunks(n.sourceChunkIds, byId);
    (n as { bodyText?: string }).bodyText = body;
    const groundedCount = n.sourceChunkIds.filter((id) => byId.has(id)).length;
    if (chunks.length > 0 && groundedCount === 0) {
      diagnostics.noteClientIdsWithoutChunks.push(n.clientId);
    }
  }

  return diagnostics;
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
  const client = new Anthropic({ apiKey });
  const payload = notes.map((n) => ({
    noteClientId: n.clientId,
    title: n.title,
    summary: n.summary,
    bodyPreview: n.bodyPreview,
    candidates: candidatesByNoteClientId[n.clientId] ?? [],
  }));
  const user = `NOTES AND CANDIDATES (JSON):\n${JSON.stringify(payload).slice(0, MERGE_USER_JSON_MAX)}`;

  const res = await withDeadline(
    client.messages.create({
      model,
      max_tokens: 8192,
      system: MERGE_SYSTEM,
      messages: [{ role: "user", content: user }],
    }),
    anthropicLlmDeadlineMs(),
    "lore_import_merge",
  );
  let raw = "";
  for (const block of res.content) {
    if (block.type === "text") raw += block.text;
  }
  const jsonStr = extractJsonObject(raw);
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
  for (let i = 0; i < mergeInput.length; i += MERGE_NOTE_BATCH) {
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
  const client = new Anthropic({ apiKey });
  const user = `IMPORT PLAN CONTEXT (JSON):\n${JSON.stringify(context).slice(0, CLARIFY_USER_JSON_MAX)}`;
  const res = await withDeadline(
    client.messages.create({
      model,
      max_tokens: 8192,
      system: CLARIFY_SYSTEM,
      messages: [{ role: "user", content: user }],
    }),
    anthropicLlmDeadlineMs(),
    "lore_import_clarify",
  );
  let raw = "";
  for (const block of res.content) {
    if (block.type === "text") raw += block.text;
  }
  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr) as { clarifications?: unknown[] };
    return Array.isArray(parsed.clarifications) ? parsed.clarifications : [];
  } catch {
    return [];
  }
}

export function attachBodiesToOutline(
  outline: OutlineLlmResult,
  chunks: SourceTextChunk[],
): ChunkAssignmentDiagnostics {
  if (outline.notes.length === 0 && chunks.length > 0) {
    outline.notes.push({
      clientId: "n_fallback",
      title: chunks[0]!.heading.slice(0, 255) || "Imported document",
      canonicalEntityKind: "lore",
      summary: "Auto-generated from source chunks.",
      folderClientId: null,
      sourceChunkIds: chunks.map((c) => c.id),
    });
  }
  return fillNoteBodiesFromChunks(outline.notes, chunks);
}
