import type { JSONContent } from "@tiptap/core";

import { EMPTY_HG_DOC } from "@/src/lib/hg-doc/constants";
import { htmlFragmentToHgDocDoc } from "@/src/lib/hg-doc/html-to-doc";
import {
  type HgStructuredBlock,
  type HgStructuredBody,
  hgStructuredBodySchema,
} from "@/src/lib/hg-doc/structured-body";
import {
  lintAndRepairStructuredBody,
  type StructureReport,
} from "@/src/lib/hg-doc/structured-body-heuristics";
import {
  VIGIL_ITEM_LINK_RE,
  WIKI_VIGIL_ITEM_LINK_RE,
} from "@/src/lib/uuid-like";

interface ParseOptions {
  requireH1?: boolean;
  title?: string;
}

type BuildOptions = ParseOptions & {
  aiPending?: boolean;
};

const AMPERSAND_RE = /&/g;
const LT_RE = /</g;
const GT_RE = />/g;
const DOUBLE_QUOTE_RE = /"/g;
const CRLF_OR_CR_RE = /\r\n?/g;
const HORIZONTAL_RULE_LINE_RE = /^-{3,}$/;
const MARKDOWN_HEADING_LINE_RE = /^(#{1,3})\s+(.+)$/;
const MARKDOWN_HEADING_PREFIX_RE = /^(#{1,3})\s+/;
const MARKDOWN_QUOTE_PREFIX_RE = /^>\s+/;
const MARKDOWN_QUOTE_LINE_RE = /^>\s+(.+)$/;
const MARKDOWN_BULLET_LIST_LINE_RE = /^[-*]\s+(.+)$/;
const MARKDOWN_BULLET_LIST_PREFIX_RE = /^[-*]\s+/;
const MARKDOWN_ORDERED_LIST_LINE_RE = /^\d+\.\s+(.+)$/;
const MARKDOWN_ORDERED_LIST_PREFIX_RE = /^\d+\.\s+/;

function escapeHtml(text: string): string {
  return text
    .replace(AMPERSAND_RE, "&amp;")
    .replace(LT_RE, "&lt;")
    .replace(GT_RE, "&gt;")
    .replace(DOUBLE_QUOTE_RE, "&quot;");
}

function inlineTextToHtml(text: string): string {
  const raw = text ?? "";
  let out = "";
  let idx = 0;
  for (const m of raw.matchAll(WIKI_VIGIL_ITEM_LINK_RE)) {
    const start = m.index ?? 0;
    out += escapeHtml(raw.slice(idx, start));
    const title = (m[1] ?? "").trim() || "Untitled";
    const itemId = m[2] ?? "";
    out += `<a href="vigil:item:${itemId}">${escapeHtml(title)}</a>`;
    idx = start + m[0].length;
  }
  out += escapeHtml(raw.slice(idx));
  return out.replace(
    VIGIL_ITEM_LINK_RE,
    (_full, itemId: string) =>
      `<a href="vigil:item:${itemId}">vigil:item:${itemId}</a>`
  );
}

function pendingWrap(inner: string, aiPending?: boolean): string {
  if (!aiPending) {
    return inner;
  }
  return `<span data-hg-ai-pending="true">${inner}</span>`;
}

function blockToHtml(block: HgStructuredBlock, aiPending?: boolean): string {
  if (block.kind === "heading") {
    const level = Math.min(3, Math.max(1, block.level));
    return `<h${level}>${pendingWrap(inlineTextToHtml(block.text), aiPending)}</h${level}>`;
  }
  if (block.kind === "paragraph") {
    return `<p>${pendingWrap(inlineTextToHtml(block.text), aiPending)}</p>`;
  }
  if (block.kind === "quote") {
    return `<blockquote><p>${pendingWrap(inlineTextToHtml(block.text), aiPending)}</p></blockquote>`;
  }
  if (block.kind === "bullet_list") {
    return `<ul>${block.items
      .map(
        (item) => `<li>${pendingWrap(inlineTextToHtml(item), aiPending)}</li>`
      )
      .join("")}</ul>`;
  }
  if (block.kind === "ordered_list") {
    return `<ol>${block.items
      .map(
        (item) => `<li>${pendingWrap(inlineTextToHtml(item), aiPending)}</li>`
      )
      .join("")}</ol>`;
  }
  return "<hr />";
}

function blockToPlainText(block: HgStructuredBlock): string {
  if (block.kind === "heading") {
    const marks = "#".repeat(Math.min(3, Math.max(1, block.level)));
    return `${marks} ${block.text}`.trim();
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
    return block.items.map((item, idx) => `${idx + 1}. ${item}`).join("\n");
  }
  return "---";
}

function parseListItems(
  lines: string[],
  index: number,
  pattern: RegExp
): { items: string[]; nextIndex: number } {
  const items: string[] = [];
  let i = index;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const m = pattern.exec(line.trim());
    if (!m) {
      break;
    }
    const text = (m[1] ?? "").trim();
    if (text) {
      items.push(text);
    }
    i += 1;
  }
  return { items, nextIndex: i };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: markdown-to-structured-body parser walks lines and dispatches per heading/list/quote/paragraph block kind
export function markdownToStructuredBody(
  markdown: string,
  options: ParseOptions = {}
): HgStructuredBody {
  const normalized = (markdown ?? "").replace(CRLF_OR_CR_RE, "\n").trim();
  const lines = normalized ? normalized.split("\n") : [];
  const blocks: HgStructuredBlock[] = [];

  for (let i = 0; i < lines.length; ) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }
    if (HORIZONTAL_RULE_LINE_RE.test(trimmed)) {
      blocks.push({ kind: "hr" });
      i += 1;
      continue;
    }
    const heading = MARKDOWN_HEADING_LINE_RE.exec(trimmed);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: Math.min(3, heading[1]?.length ?? 1) as 1 | 2 | 3,
        text: (heading[2] ?? "").trim(),
      });
      i += 1;
      continue;
    }
    if (MARKDOWN_QUOTE_PREFIX_RE.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const q = (lines[i] ?? "").trim();
        const qm = MARKDOWN_QUOTE_LINE_RE.exec(q);
        if (!qm) {
          break;
        }
        quoteLines.push((qm[1] ?? "").trim());
        i += 1;
      }
      const text = quoteLines.join(" ").trim();
      if (text) {
        blocks.push({ kind: "quote", text });
      }
      continue;
    }
    const bullet = parseListItems(lines, i, MARKDOWN_BULLET_LIST_LINE_RE);
    if (bullet.items.length > 0) {
      blocks.push({ items: bullet.items, kind: "bullet_list" });
      i = bullet.nextIndex;
      continue;
    }
    const ordered = parseListItems(lines, i, MARKDOWN_ORDERED_LIST_LINE_RE);
    if (ordered.items.length > 0) {
      blocks.push({ items: ordered.items, kind: "ordered_list" });
      i = ordered.nextIndex;
      continue;
    }
    const paraLines: string[] = [];
    while (i < lines.length) {
      const candidate = (lines[i] ?? "").trim();
      if (!candidate) {
        break;
      }
      if (HORIZONTAL_RULE_LINE_RE.test(candidate)) {
        break;
      }
      if (MARKDOWN_HEADING_PREFIX_RE.test(candidate)) {
        break;
      }
      if (MARKDOWN_QUOTE_PREFIX_RE.test(candidate)) {
        break;
      }
      if (MARKDOWN_BULLET_LIST_PREFIX_RE.test(candidate)) {
        break;
      }
      if (MARKDOWN_ORDERED_LIST_PREFIX_RE.test(candidate)) {
        break;
      }
      paraLines.push(candidate);
      i += 1;
    }
    const text = paraLines.join(" ").trim();
    if (text) {
      blocks.push({ kind: "paragraph", text });
    }
  }

  const base = {
    blocks:
      blocks.length > 0
        ? blocks
        : [{ kind: "paragraph", text: (normalized || "Untitled").trim() }],
  };
  const valid = hgStructuredBodySchema.safeParse(base);
  const body: HgStructuredBody = valid.success
    ? valid.data
    : { blocks: [{ kind: "paragraph", text: "Untitled" }] };
  return lintAndRepairStructuredBody(body, options).body;
}

export function structuredBodyToHgDoc(
  input: HgStructuredBody,
  options: BuildOptions = {}
): { doc: JSONContent; plainText: string; structureReport: StructureReport } {
  const parsed = hgStructuredBodySchema.safeParse(input);
  const base = parsed.success
    ? parsed.data
    : { blocks: [] as HgStructuredBlock[] };
  if (base.blocks.length === 0) {
    return {
      doc: structuredClone(EMPTY_HG_DOC),
      plainText: "",
      structureReport: {
        autoPrependedH1: false,
        collapsedDuplicateTitleParagraph: false,
        demotedOrphanH3Count: 0,
        finalHeadingCount: { h1: 0, h2: 0, h3: 0 },
        flaggedFlatLongBody: false,
        promotedH3ToH2Count: 0,
      },
    };
  }
  const linted = lintAndRepairStructuredBody(base, {
    requireH1: options.requireH1,
    title: options.title,
  });
  const html = linted.body.blocks
    .map((b) => blockToHtml(b, options.aiPending))
    .join("");
  const doc = htmlFragmentToHgDocDoc(html);
  const plainText = linted.body.blocks
    .map((b) => blockToPlainText(b))
    .join("\n\n")
    .trim();
  return {
    doc,
    plainText,
    structureReport: linted.report,
  };
}
