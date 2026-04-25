import { Mark, mergeAttributes } from "@tiptap/core";
import type { MarkType } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";

export const HG_AI_PENDING_CLEAR_META = "hgAiPendingClear";

const hgAiPendingClearKey = new PluginKey("hgAiPendingClear");

/**
 * Max gap (chars) between two hgAiPending runs in the same textblock that we treat as one logical
 * pending span (split caused by typing in the middle). Used when mapping edit position → range.
 */
/** Exported for gutter merge (split runs from mid-span typing). */
export const HG_AI_PENDING_SPLIT_GAP_MAX = 4;

export function areHgAiPendingRunsInSameTextblock(
  doc: EditorState["doc"],
  posA: number,
  posB: number
): boolean {
  try {
    const $a = doc.resolve(Math.min(posA, posB));
    const $b = doc.resolve(Math.max(posA, posB));
    return $a.parent.eq($b.parent);
  } catch {
    return false;
  }
}

/**
 * In `state` (before the edit), find the contiguous hgAiPending range that should be cleared when
 * the user edits at `pos` — either inside a marked run, or in a small gap between two split runs.
 */
export function expandHgAiPendingRangeBeforeEdit(
  state: EditorState,
  pos: number,
  markType: MarkType
): { from: number; to: number } | null {
  const doc = state.doc;
  const raw: { from: number; to: number }[] = [];
  doc.descendants((node, nodePos) => {
    if (!node.isText) {
      return;
    }
    if (!node.marks.some((m) => m.type === markType)) {
      return;
    }
    const len = node.text?.length ?? 0;
    raw.push({ from: nodePos, to: nodePos + len });
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
  for (const r of merged) {
    if (pos >= r.from && pos <= r.to) {
      return r;
    }
  }
  for (let i = 0; i < merged.length - 1; i++) {
    const left = merged[i]!;
    const right = merged[i + 1]!;
    const gap = right.from - left.to;
    if (gap > HG_AI_PENDING_SPLIT_GAP_MAX) {
      continue;
    }
    if (!areHgAiPendingRunsInSameTextblock(doc, left.to, right.from)) {
      continue;
    }
    if (pos >= left.to && pos <= right.from) {
      return { from: left.from, to: right.to };
    }
  }
  return null;
}

/**
 * Inline mark for lore-import / LLM text that has not been reviewed yet.
 * Renders as `<span data-hg-ai-pending="true" class="hgAiPending">`.
 */
export const HgAiPending = Mark.create({
  name: "hgAiPending",
  inclusive: false,

  parseHTML() {
    return [
      { tag: 'span[data-hg-ai-pending="true"]' },
      { tag: "span.hgAiPending" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-hg-ai-pending": "true",
        class: "hgAiPending",
      }),
      0,
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: hgAiPendingClearKey,
        appendTransaction(transactions, oldState, newState) {
          if (transactions.some((t) => t.getMeta(HG_AI_PENDING_CLEAR_META))) {
            return null;
          }
          const markType = newState.schema.marks.hgAiPending;
          if (!markType) {
            return null;
          }

          let tr = newState.tr;
          let modified = false;

          for (const tx of transactions) {
            if (!tx.docChanged) {
              continue;
            }
            if (tx.getMeta(HG_AI_PENDING_CLEAR_META)) {
              continue;
            }
            /** `setContent({ emitUpdate: false })` — do not treat as typing inside a pending span. */
            if (tx.getMeta("preventUpdate")) {
              continue;
            }
            /** Typing is a single ReplaceStep; multi-step (e.g. some pastes) skips here. */
            if (tx.steps.length !== 1) {
              continue;
            }
            const step = tx.steps[0]!;
            if (!(step instanceof ReplaceStep)) {
              continue;
            }
            /**
             * Full-document replace (initial `setContent`, programmatic loads) uses one ReplaceStep
             * from 0 to `doc.content.size` — same shape as a keypress in isolation, but must not strip marks.
             */
            if (step.from === 0 && step.to === oldState.doc.content.size) {
              continue;
            }
            const expanded = expandHgAiPendingRangeBeforeEdit(
              oldState,
              step.from,
              markType
            );
            if (!expanded) {
              continue;
            }
            const mappedFrom = tx.mapping.map(expanded.from, -1);
            const mappedTo = tx.mapping.map(expanded.to, 1);
            if (mappedTo <= mappedFrom) {
              continue;
            }
            tr = tr.removeMark(mappedFrom, mappedTo, markType);
            modified = true;
          }

          return modified
            ? tr
                .setMeta(HG_AI_PENDING_CLEAR_META, true)
                .setMeta("addToHistory", true)
            : null;
        },
      }),
    ];
  },
});
