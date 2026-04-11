import type { Editor } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

/** `{ from, to }` half-open range covering the `index`th top-level doc child. */
export function nthTopLevelRange(doc: PMNode, index: number): { from: number; to: number } | null {
  if (index < 0 || index >= doc.childCount) return null;
  let from = 1;
  for (let i = 0; i < index; i++) from += doc.child(i).nodeSize;
  const node = doc.child(index);
  return { from, to: from + node.nodeSize };
}

/**
 * Move a top-level document block from `fromIndex` to the gap **before** original child `dropIndex`
 * (`dropIndex` 0 … `childCount`). Implemented by reordering the doc JSON so we avoid ProseMirror
 * join rules (e.g. heading + paragraph + delete) that corrupt the tree when splicing positions by hand.
 */
export function moveTopLevelBlock(editor: Editor, fromIndex: number, dropIndex: number): boolean {
  if (!editor.isEditable) return false;
  const json = editor.getJSON() as JSONContent;
  if (json.type !== "doc" || !Array.isArray(json.content)) return false;

  const blocks = [...json.content];
  if (fromIndex < 0 || fromIndex >= blocks.length) return false;
  if (dropIndex < 0 || dropIndex > blocks.length) return false;
  if (dropIndex === fromIndex || dropIndex === fromIndex + 1) return false;

  const [moved] = blocks.splice(fromIndex, 1);
  let insertAt = dropIndex;
  if (dropIndex > fromIndex) insertAt -= 1;
  blocks.splice(insertAt, 0, moved);

  const ok = editor.commands.setContent({ type: "doc", content: blocks });
  if (ok) editor.commands.focus();
  return ok;
}
