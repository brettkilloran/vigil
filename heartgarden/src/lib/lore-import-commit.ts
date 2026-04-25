import { normalizeLinkTypeAlias } from "@/src/lib/connection-kind-colors";
import { HG_DOC_FORMAT } from "@/src/lib/hg-doc/constants";
import {
  markdownToStructuredBody,
  structuredBodyToHgDoc,
} from "@/src/lib/hg-doc/structured-body-to-hg-doc";
import {
  buildFactionArchive091BodyHtml,
  factionArchiveRailTextsFromObjectId,
} from "@/src/lib/lore-faction-archive-html";
import type { LoreImportStructuredBody } from "@/src/lib/lore-import-plan-types";
import { LORE_LINK_TYPE_OPTIONS } from "@/src/lib/lore-link-types";
import {
  buildLocationOrdoV7BodyHtml,
  getLoreNodeSeedBodyHtml,
} from "@/src/lib/lore-node-seed-html";

const ALLOWED_LINK_TYPES = new Set<string>(
  LORE_LINK_TYPE_OPTIONS.map((o) => o.value as string)
);

export function normalizeLoreLinkType(raw: string | undefined): string {
  if (!raw) {
    return "history";
  }
  const t = normalizeLinkTypeAlias(raw);
  return ALLOWED_LINK_TYPES.has(t) ? t : "history";
}

export function escapeHtmlForNoteBody(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const VIGIL_ITEM_RE =
  /vigil:item:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
const WIKI_VIGIL_RE =
  /\[\[([^[\]]+)\]\]\s*\(vigil:item:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

function inlinePlainToHtmlWithWikiLinks(text: string): string {
  const raw = text ?? "";
  let out = "";
  let idx = 0;
  for (const m of raw.matchAll(WIKI_VIGIL_RE)) {
    const start = m.index ?? 0;
    out += escapeHtmlForNoteBody(raw.slice(idx, start));
    const title = (m[1] ?? "").trim() || "Untitled";
    const itemId = m[2] ?? "";
    out += `<a href="vigil:item:${itemId}">${escapeHtmlForNoteBody(title)}</a>`;
    idx = start + m[0].length;
  }
  out += escapeHtmlForNoteBody(raw.slice(idx));
  return out.replace(
    VIGIL_ITEM_RE,
    (_full, itemId: string) =>
      `<a href="vigil:item:${itemId}">vigil:item:${itemId}</a>`
  );
}

function plainBodyToStructuredHtmlFragment(plainBody: string): string {
  const normalized = (plainBody ?? "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    return "<p><br></p>";
  }
  const lines = normalized.split("\n");
  const blocks: string[] = [];
  for (let i = 0; i < lines.length; ) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }
    if (/^-{3,}$/.test(trimmed)) {
      blocks.push("<hr />");
      i += 1;
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const level = Math.min(6, heading[1]!.length);
      blocks.push(
        `<h${level}>${inlinePlainToHtmlWithWikiLinks(heading[2] ?? "")}</h${level}>`
      );
      i += 1;
      continue;
    }
    const paraLines: string[] = [];
    while (i < lines.length) {
      const candidate = lines[i] ?? "";
      const candTrimmed = candidate.trim();
      if (!candTrimmed) {
        break;
      }
      if (/^-{3,}$/.test(candTrimmed)) {
        break;
      }
      if (/^(#{1,6})\s+(.+)$/.test(candTrimmed)) {
        break;
      }
      paraLines.push(candidate);
      i += 1;
    }
    const inner = paraLines
      .map((l) => inlinePlainToHtmlWithWikiLinks(l))
      .join("<br />");
    blocks.push(`<p>${inner || "<br>"}</p>`);
  }
  return blocks.length > 0 ? blocks.join("") : "<p><br></p>";
}

/** Escaped HTML fragment with newlines preserved as `<br />` (merge / rich display). */
export function escapePlainBodyToHtmlFragment(plain: string): string {
  return escapeHtmlForNoteBody(plain).replace(/\n/g, "<br />");
}

const HG_ARCH_DEFAULT = {
  theme: "default",
  tapeVariant: "clear",
  rotation: 0,
  tapeRotation: 0,
} as const;

export type BuildLoreNoteContentJsonOptions = {
  /** When true, entire body is LLM/import output pending review. */
  aiPending?: boolean;
};

/** Matches `buildContentJsonForContentEntity` defaults for a simple note card. */
export function buildLoreNoteContentJson(
  plainBody: string,
  options?: BuildLoreNoteContentJsonOptions
): Record<string, unknown> {
  const inner = plainBodyToStructuredHtmlFragment(plainBody);
  const pendingWrapped =
    options?.aiPending === true
      ? `<div data-hg-ai-pending="true">${inner}</div>`
      : inner;
  const bodyHtml = `<div contenteditable="true">${pendingWrapped}</div>`;
  return {
    format: "html",
    html: bodyHtml,
    hgArch: { ...HG_ARCH_DEFAULT },
  };
}

/**
 * Merge append: approved plain text stays unmarked; proposed import text is wrapped as pending AI.
 */
export function buildLoreNoteContentJsonMerged(
  approvedPlain: string,
  proposedPlain: string
): Record<string, unknown> {
  const approved = escapePlainBodyToHtmlFragment(approvedPlain.trim());
  const proposed = escapePlainBodyToHtmlFragment(proposedPlain.trim());
  const inner = `${approved}<br /><br /><span data-hg-ai-pending="true">${proposed}</span>`;
  const bodyHtml = `<div contenteditable="true">${inner}</div>`;
  return {
    format: "html",
    html: bodyHtml,
    hgArch: { ...HG_ARCH_DEFAULT },
  };
}

function replaceClassInnerHtml(
  html: string,
  classToken: string,
  nextInnerHtml: string,
  occurrence = 0
): string {
  const re = new RegExp(
    `<([a-zA-Z0-9]+)([^>]*class="[^"]*${classToken}[^"]*"[^>]*)>([\\s\\S]*?)<\\/\\1>`,
    "g"
  );
  let idx = 0;
  return html.replace(re, (full, tagName, attrs) => {
    if (idx !== occurrence) {
      idx += 1;
      return full;
    }
    idx += 1;
    return `<${String(tagName)}${String(attrs)}>${nextInnerHtml}</${String(tagName)}>`;
  });
}

function replaceDataAttrInnerHtml(
  html: string,
  attrName: string,
  attrValue: string,
  nextInnerHtml: string
): string {
  const re = new RegExp(
    `<([a-zA-Z0-9]+)([^>]*${attrName}="${attrValue}"[^>]*)>([\\s\\S]*?)<\\/\\1>`,
    "g"
  );
  return html.replace(
    re,
    (_full, tagName, attrs) =>
      `<${String(tagName)}${String(attrs)}>${nextInnerHtml}</${String(tagName)}>`
  );
}

function toPendingInline(text: string): string {
  const t = text.trim();
  if (!t) {
    return "<br>";
  }
  return `<span data-hg-ai-pending="true">${escapeHtmlForNoteBody(t)}</span>`;
}

function toPendingParagraphs(paragraphs: string[]): string {
  const rows = paragraphs.map((p) => p.trim()).filter(Boolean);
  if (rows.length === 0) {
    return "<p><br></p>";
  }
  return rows
    .map(
      (p) =>
        `<p><span data-hg-ai-pending="true">${escapeHtmlForNoteBody(p)}</span></p>`
    )
    .join("");
}

function buildCharacterSlabContentJson(
  body: Extract<LoreImportStructuredBody, { kind: "character" }>
) {
  let html = getLoreNodeSeedBodyHtml("character", "v11");
  html = replaceClassInnerHtml(
    html,
    "charSkDisplayName",
    toPendingInline(body.name || ""),
    0
  );
  html = replaceClassInnerHtml(
    html,
    "charSkRole",
    toPendingInline(body.role || ""),
    0
  );
  html = replaceClassInnerHtml(
    html,
    "charSkMetaValue",
    toPendingInline(body.affiliation || ""),
    0
  );
  html = replaceClassInnerHtml(
    html,
    "charSkMetaValue",
    toPendingInline(body.nationality || ""),
    1
  );
  html = replaceClassInnerHtml(
    html,
    "charSkNotesBody",
    toPendingParagraphs(body.notesParagraphs),
    0
  );
  return {
    format: "html",
    html,
    hgArch: {
      ...HG_ARCH_DEFAULT,
      loreCard: { kind: "character", variant: "v11" },
    },
  } as Record<string, unknown>;
}

function buildFactionSlabContentJson(
  body: Extract<LoreImportStructuredBody, { kind: "faction" }>
) {
  const rails = factionArchiveRailTextsFromObjectId(
    body.namePrimary || "__hg-faction-import__"
  );
  const html = buildFactionArchive091BodyHtml({
    orgPrimaryInnerHtml: toPendingInline(body.namePrimary || ""),
    orgAccentInnerHtml: toPendingInline(body.nameAccent || ""),
    recordInnerHtml: toPendingParagraphs(body.recordParagraphs),
    railUpper: rails.upper,
    railLower: rails.lower,
  });
  return {
    format: "html",
    html,
    hgArch: {
      ...HG_ARCH_DEFAULT,
      loreCard: { kind: "faction", variant: "v4" },
    },
  } as Record<string, unknown>;
}

function buildLocationSlabContentJson(
  body: Extract<LoreImportStructuredBody, { kind: "location" }>
) {
  let html = buildLocationOrdoV7BodyHtml({
    name: body.name || "",
    context: body.context || "",
    detail: body.detail || "",
    notesInnerHtml: toPendingParagraphs(body.notesParagraphs),
  });
  html = replaceDataAttrInnerHtml(
    html,
    "data-hg-lore-location-field",
    "name",
    toPendingInline(body.name || "")
  );
  html = replaceDataAttrInnerHtml(
    html,
    "data-hg-lore-location-field",
    "context",
    toPendingInline(body.context || "")
  );
  html = replaceDataAttrInnerHtml(
    html,
    "data-hg-lore-location-field",
    "detail",
    toPendingInline(body.detail || "")
  );
  return {
    format: "html",
    html,
    hgArch: {
      ...HG_ARCH_DEFAULT,
      loreCard: { kind: "location", variant: "v7" },
    },
  } as Record<string, unknown>;
}

function buildGenericHgDocFromParagraphs(
  paragraphs: string[]
): Record<string, unknown> {
  const body = markdownToStructuredBody(paragraphs.join("\n\n"), {
    requireH1: false,
  });
  const { doc } = structuredBodyToHgDoc(body, {
    aiPending: true,
    requireH1: false,
  });
  return {
    format: HG_DOC_FORMAT,
    doc,
    hgArch: { ...HG_ARCH_DEFAULT },
  };
}

export function buildLoreSourceContentJson(
  fullText: string
): Record<string, unknown> {
  const paragraphs = fullText
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return buildGenericHgDocFromParagraphs(
    paragraphs.length > 0 ? paragraphs : [fullText.trim()]
  );
}

export function buildLoreStructuredBodyContentJson(
  body: LoreImportStructuredBody | undefined,
  fallbackPlainBody: string,
  title?: string
): Record<string, unknown> {
  if (!body) {
    const fallbackBody = markdownToStructuredBody(fallbackPlainBody, {
      title: title?.trim() || "Imported note",
      requireH1: true,
    });
    const { doc } = structuredBodyToHgDoc(fallbackBody, {
      aiPending: true,
      title: title?.trim() || "Imported note",
      requireH1: true,
    });
    return {
      format: HG_DOC_FORMAT,
      doc,
      hgArch: { ...HG_ARCH_DEFAULT },
    };
  }
  if (body.kind === "character") {
    return buildCharacterSlabContentJson(body);
  }
  if (body.kind === "faction") {
    return buildFactionSlabContentJson(body);
  }
  if (body.kind === "location") {
    return buildLocationSlabContentJson(body);
  }
  const { doc } = structuredBodyToHgDoc(
    { blocks: body.blocks },
    {
      aiPending: true,
      title: title?.trim() || "Imported note",
      requireH1: true,
    }
  );
  return {
    format: HG_DOC_FORMAT,
    doc,
    hgArch: { ...HG_ARCH_DEFAULT },
  };
}
