import type { Editor } from "@tiptap/core";

/** Contiguous PM ranges covered by the `hgAiPending` mark (merged across text-node splits). */
export function collectHgAiPendingRanges(editor: Editor): { from: number; to: number }[] {
  const markType = editor.schema.marks.hgAiPending;
  if (!markType) return [];
  const raw: { from: number; to: number }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    if (!node.marks.some((m) => m.type === markType)) return;
    const len = node.text?.length ?? 0;
    raw.push({ from: pos, to: pos + len });
  });
  raw.sort((a, b) => a.from - b.from);
  const merged: { from: number; to: number }[] = [];
  for (const r of raw) {
    const last = merged[merged.length - 1];
    if (last && r.from <= last.to) last.to = Math.max(last.to, r.to);
    else merged.push({ ...r });
  }
  return merged;
}
