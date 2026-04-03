import type { Editor } from "@tiptap/core";

let active: Editor | null = null;

/** Call when a note/checklist editor mounts or becomes active. */
export function registerActiveTipTapEditor(editor: Editor | null): void {
  active = editor;
}

export function getActiveTipTapEditor(): Editor | null {
  return active;
}
