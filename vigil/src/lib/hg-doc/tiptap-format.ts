import type { Editor } from "@tiptap/core";

/**
 * Maps legacy `runFormat` / `execCommand` style commands to TipTap chains.
 * Returns true when handled (including no-op guards).
 */
export function applyHgDocFormatCommand(editor: Editor, command: string, value?: string): boolean {
  if (!editor.isEditable) return false;

  const chain = () => editor.chain().focus();

  if (command === "arch:insertImage") return false;

  if (command === "bold") {
    chain().toggleBold().run();
    return true;
  }
  if (command === "italic") {
    chain().toggleItalic().run();
    return true;
  }
  if (command === "underline") {
    chain().toggleUnderline().run();
    return true;
  }
  if (command === "strikeThrough") {
    chain().toggleStrike().run();
    return true;
  }

  if (command === "insertUnorderedList") {
    chain().toggleBulletList().run();
    return true;
  }
  if (command === "insertOrderedList") {
    chain().toggleOrderedList().run();
    return true;
  }

  if (command === "insertHorizontalRule") {
    chain().setHorizontalRule().run();
    return true;
  }

  if (command === "arch:checklist") {
    // Checklist behaves like a true list toggle (not raw HTML insertion).
    chain().toggleTaskList().run();
    return true;
  }

  if (command === "formatBlock" && value === "h1") {
    // Legacy toolbar: any heading → body; otherwise promote to H1.
    if (editor.isActive("heading")) {
      chain().setParagraph().run();
    } else {
      chain().setHeading({ level: 1 }).run();
    }
    return true;
  }

  if (
    (command === "formatBlock" && value === "blockquote") ||
    command === "arch:quote" ||
    command === "arch:callout"
  ) {
    chain().toggleBlockquote().run();
    return true;
  }

  if (command === "formatBlock" && value === "p") {
    chain().setParagraph().run();
    return true;
  }

  if (command === "formatBlock" && (value === "h2" || value === "h3")) {
    const level = value === "h2" ? 2 : 3;
    chain().setHeading({ level }).run();
    return true;
  }

  return false;
}

export function readHgDocFormatChrome(editor: Editor): {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  unorderedList: boolean;
  orderedList: boolean;
  blockTag: "p" | "h1" | "h2" | "h3" | "blockquote";
} {
  let blockTag: "p" | "h1" | "h2" | "h3" | "blockquote" = "p";
  if (editor.isActive("heading", { level: 1 })) blockTag = "h1";
  else if (editor.isActive("heading", { level: 2 })) blockTag = "h2";
  else if (editor.isActive("heading", { level: 3 })) blockTag = "h3";
  else if (editor.isActive("blockquote")) blockTag = "blockquote";

  return {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
    strikeThrough: editor.isActive("strike"),
    unorderedList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    blockTag,
  };
}
