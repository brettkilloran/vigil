import type { JSONContent } from "@tiptap/core";

import { EMPTY_HG_DOC } from "@/src/lib/hg-doc/constants";

function paragraphPlainText(node: JSONContent): string | null {
  if (node.type !== "paragraph") {
    return null;
  }
  if (!node.content?.length) {
    return "";
  }
  let out = "";
  for (const c of node.content) {
    if (c.type === "text" && typeof c.text === "string") {
      if (c.marks?.length) {
        return null;
      }
      out += c.text;
    } else if (c.type === "hardBreak") {
      out += "\n";
    } else {
      return null;
    }
  }
  return out;
}

/**
 * Legacy code/snippet cards often stored a single plain paragraph after HTML→hgDoc migration.
 * Promote that shape to a real `codeBlock` so TipTap + lowlight can highlight it.
 */
export function normalizeHgDocForCodeTheme(
  doc: JSONContent | null | undefined
): JSONContent {
  const d = doc?.type === "doc" ? doc : structuredClone(EMPTY_HG_DOC);
  if (!d.content?.length || d.content.length !== 1) {
    return d;
  }
  const only = d.content[0];
  if (!only || only.type === "codeBlock") {
    return d;
  }
  const text = paragraphPlainText(only);
  if (text === null) {
    return d;
  }
  return {
    type: "doc",
    content: [
      {
        type: "codeBlock",
        attrs: { language: "typescript" },
        content: text ? [{ type: "text", text }] : [],
      },
    ],
  };
}

export function hgDocForContentEntity(entity: {
  theme: string;
  bodyDoc?: JSONContent | null;
}): JSONContent {
  const raw = entity.bodyDoc ?? structuredClone(EMPTY_HG_DOC);
  if (entity.theme === "code") {
    return normalizeHgDocForCodeTheme(raw);
  }
  return structuredClone(raw);
}
