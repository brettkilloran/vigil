import type { HgDocSection } from "@/src/lib/hg-doc/derive-sections";

/** Target max characters per vault embedding chunk (rough token proxy). */
export const VAULT_CHUNK_TARGET_CHARS = 820;
/** Overlap between consecutive chunks to preserve boundary concepts. */
export const VAULT_CHUNK_OVERLAP_CHARS = 130;
/**
 * Hard ceiling on per-item chunk count. Long lore docs (100k+ chars) would
 * otherwise produce 100+ chunks each, multiplying OpenAI embedding spend on
 * every edit. The cap keeps a single item's reindex bounded; sections beyond
 * the cap still appear in lexical FTS via `search_blob` but lose vector
 * recall. Override via `HEARTGARDEN_VAULT_MAX_CHUNKS_PER_ITEM`.
 * (`REVIEW_2026-04-25_1835` H6.)
 */
export const VAULT_DEFAULT_MAX_CHUNKS_PER_ITEM = 64;

export function vaultMaxChunksPerItem(): number {
  const raw = (process.env.HEARTGARDEN_VAULT_MAX_CHUNKS_PER_ITEM ?? "").trim();
  if (!raw) {
    return VAULT_DEFAULT_MAX_CHUNKS_PER_ITEM;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return VAULT_DEFAULT_MAX_CHUNKS_PER_ITEM;
  }
  return Math.min(512, Math.max(1, Math.floor(parsed)));
}

export type VaultChunk = {
  headingPath: string[];
  breadcrumb: string;
  chunkText: string;
};

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function chunkBreadcrumb(path: string[]): string {
  const clean = path.map((p) => p.trim()).filter(Boolean);
  return clean.join(" > ");
}

/**
 * Split one section into overlapping chunks, preferring paragraph boundaries.
 */
function splitSectionText(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((p) => normalizeWhitespace(p))
    .filter(Boolean);
  const pieces: string[] = [];
  let buf = "";

  const flushBuf = () => {
    const t = buf.trim();
    if (t) {
      pieces.push(t);
    }
    buf = "";
  };

  for (const p of paragraphs.length > 0
    ? paragraphs
    : [normalizeWhitespace(normalized)]) {
    if (!buf) {
      if (p.length <= VAULT_CHUNK_TARGET_CHARS) {
        buf = p;
        continue;
      }
      for (const hard of hardSplitParagraph(p)) {
        if (!buf) {
          buf = hard;
        } else if (buf.length + 1 + hard.length <= VAULT_CHUNK_TARGET_CHARS) {
          buf = `${buf} ${hard}`;
        } else {
          flushBuf();
          buf = hard;
        }
      }
      continue;
    }
    if (buf.length + 2 + p.length <= VAULT_CHUNK_TARGET_CHARS) {
      buf = `${buf}\n\n${p}`;
      continue;
    }
    flushBuf();
    if (p.length <= VAULT_CHUNK_TARGET_CHARS) {
      buf = p;
    } else {
      for (const hard of hardSplitParagraph(p)) {
        if (!buf) {
          buf = hard;
        } else if (buf.length + 1 + hard.length <= VAULT_CHUNK_TARGET_CHARS) {
          buf = `${buf} ${hard}`;
        } else {
          flushBuf();
          buf = hard;
        }
      }
    }
  }
  flushBuf();
  return mergeSmallPieces(applyOverlap(pieces));
}

export function chunkVaultSections(sections: HgDocSection[]): VaultChunk[] {
  const out: VaultChunk[] = [];
  for (const section of sections) {
    const headingPath =
      section.headingPath.length > 0 ? section.headingPath : ["Untitled"];
    const breadcrumb = chunkBreadcrumb(headingPath);
    const pieces = splitSectionText(section.text);
    if (pieces.length === 0 && section.text.trim()) {
      const chunkText =
        `${breadcrumb} - ${normalizeWhitespace(section.text)}`.trim();
      out.push({ headingPath, breadcrumb, chunkText });
      continue;
    }
    for (const piece of pieces) {
      const chunkText = `${breadcrumb} - ${piece}`.trim();
      out.push({ headingPath, breadcrumb, chunkText });
    }
  }
  return out;
}

/** Backward-compatible helper for headingless plain text. */
export function chunkVaultText(fullText: string): string[] {
  const body = fullText.replace(/\r\n?/g, "\n").trim();
  if (!body) {
    return [];
  }
  const chunks = chunkVaultSections([
    { headingPath: ["Untitled"], text: body, charRange: [0, body.length] },
  ]);
  return chunks.map((c) => c.chunkText);
}

function hardSplitParagraph(p: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < p.length) {
    const end = Math.min(i + VAULT_CHUNK_TARGET_CHARS, p.length);
    let slice = p.slice(i, end);
    if (end < p.length) {
      const lastSpace = slice.lastIndexOf(" ");
      if (lastSpace > VAULT_CHUNK_TARGET_CHARS * 0.5) {
        slice = slice.slice(0, lastSpace);
        i += lastSpace + 1;
        out.push(slice.trim());
        continue;
      }
    }
    out.push(slice.trim());
    i = end;
  }
  return out.filter(Boolean);
}

function mergeSmallPieces(pieces: string[]): string[] {
  if (pieces.length <= 1) {
    return pieces;
  }
  const out: string[] = [];
  let cur = pieces[0]!;
  for (let i = 1; i < pieces.length; i++) {
    const next = pieces[i]!;
    if (cur.length + 2 + next.length <= VAULT_CHUNK_TARGET_CHARS * 0.6) {
      cur = `${cur}\n\n${next}`;
    } else {
      out.push(cur);
      cur = next;
    }
  }
  out.push(cur);
  return out;
}

function applyOverlap(pieces: string[]): string[] {
  if (pieces.length <= 1) {
    return pieces;
  }
  const out: string[] = [pieces[0]!];
  for (let i = 1; i < pieces.length; i++) {
    const prev = out[out.length - 1]!;
    const cur = pieces[i]!;
    if (VAULT_CHUNK_OVERLAP_CHARS <= 0) {
      out.push(cur);
      continue;
    }
    const tail = prev
      .slice(Math.max(0, prev.length - VAULT_CHUNK_OVERLAP_CHARS))
      .trimStart();
    const merged = tail ? `${tail} … ${cur}` : cur;
    out.push(merged);
  }
  return out;
}

/**
 * Build embeddable text for an item: title prefix + body (+ optional extra index text).
 */
export function buildVaultEmbedDocument(input: {
  title: string;
  contentText: string;
  sectionBreadcrumb?: string | null;
  loreSummary?: string | null;
  loreAliases?: string[] | null;
  /** hgArch roster / thread anchors etc. — see `buildHgArchBindingSummaryText`. */
  bindingProjection?: string | null;
}): string {
  const title = input.title?.trim() ?? "";
  const body = input.contentText?.trim() ?? "";
  const aliases = (input.loreAliases ?? []).filter(Boolean).join(", ");
  const summary = input.loreSummary?.trim() ?? "";
  const bind = input.bindingProjection?.trim() ?? "";
  const meta = [
    summary && `Summary: ${summary}`,
    aliases && `Aliases: ${aliases}`,
  ]
    .filter(Boolean)
    .join("\n");
  const section = input.sectionBreadcrumb?.trim() ?? "";
  const head = section ? section : title ? `Title: ${title}` : "";
  const parts = [head, meta, bind, body].filter(Boolean);
  return parts.join("\n\n").trim();
}
