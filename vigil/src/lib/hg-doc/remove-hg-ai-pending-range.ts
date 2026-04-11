import type { Editor } from "@tiptap/core";

import { HG_AI_PENDING_CLEAR_META } from "@/src/lib/hg-doc/hg-ai-pending-mark";

/** Remove `hgAiPending` for `[from, to)` only (does not clear the whole document). */
export function removeHgAiPendingRange(editor: Editor, from: number, to: number): boolean {
  const markType = editor.schema.marks.hgAiPending;
  if (!markType) return false;
  const tr = editor.state.tr;
  tr.removeMark(from, to, markType);
  tr.setMeta(HG_AI_PENDING_CLEAR_META, true);
  editor.view.dispatch(tr);
  return true;
}
