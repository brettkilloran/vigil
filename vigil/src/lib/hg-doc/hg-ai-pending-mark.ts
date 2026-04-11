import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";

export const HG_AI_PENDING_CLEAR_META = "hgAiPendingClear";

const hgAiPendingClearKey = new PluginKey("hgAiPendingClear");

/**
 * Inline mark for lore-import / LLM text that has not been reviewed yet.
 * Renders as `<span data-hg-ai-pending="true" class="hgAiPending">`.
 */
export const HgAiPending = Mark.create({
  name: "hgAiPending",
  inclusive: false,

  parseHTML() {
    return [{ tag: 'span[data-hg-ai-pending="true"]' }, { tag: "span.hgAiPending" }];
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
          if (!markType) return null;

          let tr = newState.tr;
          let modified = false;

          for (const tx of transactions) {
            if (!tx.docChanged) continue;
            if (tx.getMeta(HG_AI_PENDING_CLEAR_META)) continue;
            /** `setContent({ emitUpdate: false })` — do not treat as typing inside a pending span. */
            if (tx.getMeta("preventUpdate")) continue;
            /** Typing is a single ReplaceStep; multi-step (e.g. some pastes) skips here. */
            if (tx.steps.length !== 1) continue;
            const step = tx.steps[0]!;
            if (!(step instanceof ReplaceStep)) continue;
            /**
             * Full-document replace (initial `setContent`, programmatic loads) uses one ReplaceStep
             * from 0 to `doc.content.size` — same shape as a keypress in isolation, but must not strip marks.
             */
            if (step.from === 0 && step.to === oldState.doc.content.size) {
              continue;
            }
            const from = tx.mapping.map(step.from, -1);
            const end = from + step.slice.content.size;
            if (end <= from) continue;
            if (newState.doc.rangeHasMark(from, end, markType)) {
              tr = tr.removeMark(from, end, markType);
              modified = true;
            }
          }

          return modified ? tr.setMeta(HG_AI_PENDING_CLEAR_META, true) : null;
        },
      }),
    ];
  },
});
