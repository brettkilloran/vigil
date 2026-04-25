import type { Extensions, JSONContent } from "@tiptap/core";
import { generateJSON } from "@tiptap/html";

import { EMPTY_HG_DOC } from "@/src/lib/hg-doc/constants";
import { getHgDocExtensions } from "@/src/lib/hg-doc/extensions";

const ext = getHgDocExtensions({ withPlaceholder: false }) as Extensions;

/**
 * Parse a loose HTML fragment (e.g. lore notes innerHTML) into a TipTap hgDoc JSON tree.
 * Used when migrating legacy HTML surfaces onto HeartgardenDocEditor.
 */
export function htmlFragmentToHgDocDoc(fragmentHtml: string): JSONContent {
  const trimmed = (fragmentHtml ?? "").trim();
  if (!trimmed) {
    return structuredClone(EMPTY_HG_DOC);
  }
  try {
    return generateJSON(trimmed, ext);
  } catch {
    return structuredClone(EMPTY_HG_DOC);
  }
}

/**
 * Best-effort HTML → plain string for migration and previews (not a full HTML parser).
 * Strips `script` / `style`, removes tags, decodes a small set of entities, collapses whitespace.
 */
export function stripLegacyHtmlToPlainText(html: string): string {
  const stripped = (html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return stripped
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(?:x0*A0|0*160);/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Plain text from an HTML fragment that may use `<br>` for soft line breaks (e.g. ORDO v7 title lines).
 * `Node.textContent` does not insert a separator across `<br>`, so "LINE1" + "LINE2" becomes "LINE1LINE2".
 */
export function plainTextFromInlineHtmlFragment(html: string): string {
  const trimmed = (html ?? "").trim();
  if (!trimmed) {
    return "";
  }
  const withBrAsSpace = trimmed.replace(/<br\s*\/?>/gi, " ");
  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(
        `<div>${withBrAsSpace}</div>`,
        "text/html"
      );
      return (doc.body?.textContent ?? "").replace(/\s+/g, " ").trim();
    } catch {
      /* ignore */
    }
  }
  return stripLegacyHtmlToPlainText(withBrAsSpace);
}

/**
 * Legacy code-theme bodies were stored as decorated HTML; produce a single hgDoc `codeBlock`
 * so the TipTap + lowlight surface can highlight it.
 */
export function legacyCodeBodyHtmlToHgDocSeed(html: string): JSONContent {
  const plain = stripLegacyHtmlToPlainText(html);
  if (!plain) {
    return structuredClone(EMPTY_HG_DOC);
  }
  const text = plain.length > 50_000 ? plain.slice(0, 50_000) : plain;
  return {
    content: [
      {
        attrs: { language: "typescript" },
        content: [{ text, type: "text" }],
        type: "codeBlock",
      },
    ],
    type: "doc",
  };
}
