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

/** Legacy code-theme bodies were stored as raw HTML; seed a simple hgDoc paragraph. */
export function legacyCodeBodyHtmlToHgDocSeed(html: string): JSONContent {
  const plain = (html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
