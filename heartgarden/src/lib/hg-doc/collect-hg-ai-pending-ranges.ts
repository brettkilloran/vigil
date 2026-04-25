import type { Editor } from "@tiptap/core";

import {
  areHgAiPendingRunsInSameTextblock,
  HG_AI_PENDING_SPLIT_GAP_MAX,
} from "@/src/lib/hg-doc/hg-ai-pending-mark";

export interface HgAiPendingRangeMetrics {
  pendingChars: number;
  pendingCoverage: number;
  ranges: { from: number; to: number }[];
  totalTextChars: number;
}

/** Contiguous PM ranges covered by the `hgAiPending` mark (merged across text-node splits). */
export function collectHgAiPendingRanges(
  editor: Editor
): { from: number; to: number }[] {
  return collectHgAiPendingRangeMetrics(editor).ranges;
}

export function collectHgAiPendingRangeMetrics(
  editor: Editor
): HgAiPendingRangeMetrics {
  const markType = editor.schema.marks.hgAiPending;
  if (!markType) {
    return {
      ranges: [],
      pendingChars: 0,
      totalTextChars: 0,
      pendingCoverage: 0,
    };
  }
  const doc = editor.state.doc;
  const raw: { from: number; to: number }[] = [];
  let pendingChars = 0;
  let totalTextChars = 0;
  doc.descendants((node, pos) => {
    if (!node.isText) {
      return;
    }
    const len = node.text?.length ?? 0;
    totalTextChars += len;
    if (!node.marks.some((m) => m.type === markType)) {
      return;
    }
    pendingChars += len;
    raw.push({ from: pos, to: pos + len });
  });
  raw.sort((a, b) => a.from - b.from);
  const merged: { from: number; to: number }[] = [];
  for (const r of raw) {
    const last = merged.at(-1);
    if (last && r.from <= last.to) {
      last.to = Math.max(last.to, r.to);
    } else {
      merged.push({ ...r });
    }
  }
  const mergedSplits: { from: number; to: number }[] = [];
  for (const r of merged) {
    const last = mergedSplits.at(-1);
    if (
      last &&
      r.from > last.to &&
      r.from - last.to <= HG_AI_PENDING_SPLIT_GAP_MAX &&
      areHgAiPendingRunsInSameTextblock(doc, last.to, r.from)
    ) {
      last.to = Math.max(last.to, r.to);
    } else {
      mergedSplits.push({ ...r });
    }
  }
  const pendingCoverage =
    totalTextChars > 0 ? pendingChars / totalTextChars : 0;
  return {
    ranges: mergedSplits,
    pendingChars,
    totalTextChars,
    pendingCoverage,
  };
}
