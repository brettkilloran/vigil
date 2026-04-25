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

interface ParseOptions {
  requireH1?: boolean;
  title?: string;
}

type BuildOptions = ParseOptions & {
  aiPending?: boolean;
};

const VIGIL_ITEM_RE =
  /vigil:item:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
const WIKI_VIGIL_RE =
  /\[\[([^[\]]+)\]\]\s*\(vigil:item:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineTextToHtml(text: string): string {
  const raw = text ?? "";
  let out = "";
  let idx = 0;
  for (const m of raw.matchAll(WIKI_VIGIL_RE)) {
    const start = m.index ?? 0;
    out += escapeHtml(raw.slice(idx, start));
    const title = (m[1] ?? "").trim() || "Untitled";
    const itemId = m[2] ?? "";
    out += `<a href="vigil:item:${itemId}">${escapeHtml(title)}</a>`;
    idx = start + m[0].length;
  }
  out += escapeHtml(raw.slice(idx));
  return out.replace(
    VIGIL_ITEM_RE,
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

export function markdownToStructuredBody(
  markdown: string,
  options: ParseOptions = {}
): HgStructuredBody {
  const normalized = (markdown ?? "").replace(/\r\n?/g, "\n").trim();
  const lines = normalized ? normalized.split("\n") : [];
  const blocks: HgStructuredBlock[] = [];

  for (let i = 0; i < lines.length; ) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }
    if (/^-{3,}$/.test(trimmed)) {
      blocks.push({ kind: "hr" });
      i += 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: Math.min(3, heading[1]?.length ?? 1) as 1 | 2 | 3,
        text: (heading[2] ?? "").trim(),
      });
      i += 1;
      continue;
    }
    if (/^>\s+/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const q = (lines[i] ?? "").trim();
        const qm = /^>\s+(.+)$/.exec(q);
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
    const bullet = parseListItems(lines, i, /^[-*]\s+(.+)$/);
    if (bullet.items.length > 0) {
      blocks.push({ kind: "bullet_list", items: bullet.items });
      i = bullet.nextIndex;
      continue;
    }
    const ordered = parseListItems(lines, i, /^\d+\.\s+(.+)$/);
    if (ordered.items.length > 0) {
      blocks.push({ kind: "ordered_list", items: ordered.items });
      i = ordered.nextIndex;
      continue;
    }
    const paraLines: string[] = [];
    while (i < lines.length) {
      const candidate = (lines[i] ?? "").trim();
      if (!candidate) {
        break;
      }
      if (/^-{3,}$/.test(candidate)) {
        break;
      }
      if (/^(#{1,3})\s+/.test(candidate)) {
        break;
      }
      if (/^>\s+/.test(candidate)) {
        break;
      }
      if (/^[-*]\s+/.test(candidate)) {
        break;
      }
      if (/^\d+\.\s+/.test(candidate)) {
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
        demotedOrphanH3Count: 0,
        promotedH3ToH2Count: 0,
        flaggedFlatLongBody: false,
        collapsedDuplicateTitleParagraph: false,
        finalHeadingCount: { h1: 0, h2: 0, h3: 0 },
      },
    };
  }
  const linted = lintAndRepairStructuredBody(base, {
    title: options.title,
    requireH1: options.requireH1,
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
