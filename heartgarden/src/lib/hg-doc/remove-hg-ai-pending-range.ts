import type { Editor } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";

import { HG_AI_PENDING_CLEAR_META } from "@/src/lib/hg-doc/hg-ai-pending-mark";

/** Remove `hgAiPending` for `[from, to)` only (does not clear the whole document). */
export function removeHgAiPendingRange(
  editor: Editor,
  from: number,
  to: number
): boolean {
  const markType = editor.schema.marks.hgAiPending;
  if (!markType) {
    return false;
  }
  const tr = closeHistory(editor.state.tr.removeMark(from, to, markType));
  editor.view.dispatch(tr.setMeta(HG_AI_PENDING_CLEAR_META, true));
  return true;
}
