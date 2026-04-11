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
  if (!trimmed) return structuredClone(EMPTY_HG_DOC);
  try {
    return generateJSON(trimmed, ext);
  } catch {
    return structuredClone(EMPTY_HG_DOC);
  }
}

/** Strip legacy code-card HTML to a single plain paragraph (TipTap hgDoc). */
function legacyCodeHtmlToPlainParagraphText(html: string): string {
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

/** Legacy code-theme bodies were stored as raw HTML; seed a simple hgDoc paragraph. */
export function legacyCodeBodyHtmlToHgDocSeed(html: string): JSONContent {
  const plain = legacyCodeHtmlToPlainParagraphText(html);
  if (!plain) return structuredClone(EMPTY_HG_DOC);
  const text = plain.length > 50_000 ? plain.slice(0, 50_000) : plain;
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}
