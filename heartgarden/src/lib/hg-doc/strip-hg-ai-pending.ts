import type { JSONContent } from "@tiptap/core";

import type { CanvasContentEntity } from "@/src/components/foundation/architectural-types";

const HG_AI_PENDING_CLASS_RE = /\bhgAiPending\b/;

/** True if the hgDoc JSON tree still contains `hgAiPending` marks. */
export function hgDocJsonHasHgAiPending(
  doc: JSONContent | null | undefined
): boolean {
  if (!doc) {
    return false;
  }
  if (
    Array.isArray(doc.marks) &&
    doc.marks.some((m) => m.type === "hgAiPending")
  ) {
    return true;
  }
  if (Array.isArray(doc.content)) {
    return doc.content.some((c) => hgDocJsonHasHgAiPending(c));
  }
  return false;
}

export function stripHgAiPendingFromHgDocJson(doc: JSONContent): JSONContent {
  function walk(node: JSONContent): JSONContent {
    const next: JSONContent = { ...node };
    if (Array.isArray(node.marks)) {
      const filtered = node.marks.filter((m) => m.type !== "hgAiPending");
      if (filtered.length === 0) {
        next.marks = undefined;
      } else {
        next.marks = filtered;
      }
    }
    if (Array.isArray(node.content)) {
      next.content = node.content.map(walk);
    }
    return next;
  }
  return walk(doc);
}

/** Best-effort: unwrap our pending spans (non-nested) from stored note HTML. */
export function stripHgAiPendingFromHtml(html: string): string {
  let out = html;
  // Use a lookahead so `[^>]*` cannot consume `data-hg-ai-pending` before the literal matches.
  const re =
    /<span(?=[^>]*(?:\bdata-hg-ai-pending="true"|\bdata-hg-ai-pending='true'|\bclass="[^"]*\bhgAiPending\b))[^>]*>([\s\S]*?)<\/span>/gi;
  for (let i = 0; i < 64; i++) {
    const next = out.replace(re, (_, inner: string) => inner);
    if (next === out) {
      break;
    }
    out = next;
  }
  return out;
}

export function htmlStringHasHgAiPending(html: string): boolean {
  return (
    html.includes('data-hg-ai-pending="true"') ||
    html.includes("data-hg-ai-pending='true'") ||
    HG_AI_PENDING_CLASS_RE.test(html)
  );
}

/** True if body still contains pending-AI marks or spans. */
export function contentEntityHasHgAiPending(ent: CanvasContentEntity): boolean {
  if (ent.bodyDoc != null && hgDocJsonHasHgAiPending(ent.bodyDoc)) {
    return true;
  }
  return htmlStringHasHgAiPending(ent.bodyHtml);
}
