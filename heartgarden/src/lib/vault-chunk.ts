/** Target max characters per vault embedding chunk (rough token proxy). */
export const VAULT_CHUNK_TARGET_CHARS = 820;
/** Overlap between consecutive chunks to preserve boundary concepts. */
export const VAULT_CHUNK_OVERLAP_CHARS = 130;

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Split note text into overlapping chunks, preferring paragraph boundaries.
 */
export function chunkVaultText(fullText: string): string[] {
  const text = normalizeWhitespace(fullText);
  if (!text) return [];

  const paragraphs = text.split(/\n\s*\n/).map((p) => normalizeWhitespace(p)).filter(Boolean);
  const pieces: string[] = [];
  let buf = "";

  const flushBuf = () => {
    const t = buf.trim();
    if (t) pieces.push(t);
    buf = "";
  };

  for (const p of paragraphs) {
    if (!buf) {
      if (p.length <= VAULT_CHUNK_TARGET_CHARS) {
        buf = p;
        continue;
      }
      for (const hard of hardSplitParagraph(p)) {
        if (!buf) buf = hard;
        else if (buf.length + 1 + hard.length <= VAULT_CHUNK_TARGET_CHARS) buf = `${buf} ${hard}`;
        else {
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
  if (pieces.length <= 1) return pieces;
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
  if (pieces.length <= 1) return pieces;
  const out: string[] = [pieces[0]!];
  for (let i = 1; i < pieces.length; i++) {
    const prev = out[out.length - 1]!;
    const cur = pieces[i]!;
    if (VAULT_CHUNK_OVERLAP_CHARS <= 0) {
      out.push(cur);
      continue;
    }
    const tail = prev.slice(Math.max(0, prev.length - VAULT_CHUNK_OVERLAP_CHARS)).trimStart();
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
  const meta = [summary && `Summary: ${summary}`, aliases && `Aliases: ${aliases}`]
    .filter(Boolean)
    .join("\n");
  const head = title ? `Title: ${title}` : "";
  const parts = [head, meta, bind, body].filter(Boolean);
  return parts.join("\n\n").trim();
}
