import type { JSONContent } from "@tiptap/core";
import { generateHTML } from "@tiptap/html";

import { EMPTY_HG_DOC } from "@/src/lib/hg-doc/constants";
import { getHgDocExtensions } from "@/src/lib/hg-doc/extensions";

/** Server/client: deterministic HTML snapshot for link extraction and legacy HTML paths. */
export function hgDocToHtml(doc: JSONContent | null | undefined): string {
  const safe = doc?.type === "doc" ? doc : EMPTY_HG_DOC;
  try {
    return generateHTML(
      safe,
      getHgDocExtensions({ withPlaceholder: false }) as never
    );
  } catch {
    return "<p></p>";
  }
}
