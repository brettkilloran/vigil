import type { EditorState } from "@tiptap/pm/state";

/** Active `[[...` wiki-link input at cursor (within current textblock). */
export function getWikiLinkRangeFromState(state: EditorState): {
  from: number;
  to: number;
  query: string;
} | null {
  const $from = state.selection.$from;
  const blockStart = $from.start();
  const pos = $from.pos;
  const blockText = state.doc.textBetween(blockStart, pos, "\0", "\0");
  const match = blockText.match(/\[\[([^\]\0]*)$/);
  if (!match) return null;
  const from = blockStart + blockText.length - match[0].length;
  const to = pos;
  return { from, to, query: match[1] ?? "" };
}
