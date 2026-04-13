import type { JSONContent } from "@tiptap/core";

import { EMPTY_HG_DOC, HG_DOC_FORMAT } from "@/src/lib/hg-doc/constants";

/** Recursively extract plain text from TipTap JSON for search / content_text. */
export function hgDocToPlainText(doc: JSONContent | null | undefined): string {
  if (!doc) return "";
  const parts: string[] = [];

  const walk = (node: JSONContent) => {
    if (node.text) parts.push(node.text);
    if (node.type === "horizontalRule") parts.push("—");
    if (node.type === "image") {
      const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
      if (alt) parts.push(alt);
      else if (src) parts.push(src);
    }
    if (Array.isArray(node.content)) {
      for (const c of node.content) walk(c);
    }
  };

  walk(doc);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function isHgDocContentJson(cj: Record<string, unknown> | null): boolean {
  if (!cj) return false;
  return cj.format === HG_DOC_FORMAT && cj.doc != null && typeof cj.doc === "object";
}

export function readHgDocFromContentJson(
  cj: Record<string, unknown> | null,
): JSONContent {
  if (!cj || !isHgDocContentJson(cj)) return EMPTY_HG_DOC;
  const doc = cj.doc as JSONContent;
  if (doc?.type !== "doc") return EMPTY_HG_DOC;
  return doc;
}
