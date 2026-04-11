"use client";

import { DotsSixVertical } from "@phosphor-icons/react";
import type { JSONContent } from "@tiptap/core";
import DragHandle from "@tiptap/extension-drag-handle-react";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useMemo } from "react";

import { EMPTY_HG_DOC } from "@/src/lib/hg-doc/constants";
import type { HgDocEditorApi } from "@/src/lib/hg-doc/editor-registry";
import { registerHgDocEditor } from "@/src/lib/hg-doc/editor-registry";
import { getHgDocExtensions } from "@/src/lib/hg-doc/extensions";
import { applyHgDocFormatCommand, readHgDocFormatChrome } from "@/src/lib/hg-doc/tiptap-format";

import styles from "@/src/components/editing/HeartgardenDocEditor.module.css";

export type HeartgardenDocChromeRole = "focus" | "canvas";

export type HeartgardenDocEditorProps = {
  surfaceKey: string;
  chromeRole: HeartgardenDocChromeRole;
  value: JSONContent;
  onChange?: (doc: JSONContent) => void;
  editable?: boolean;
  placeholder?: string | null;
  className?: string;
  enableDragHandle?: boolean;
};

export function HeartgardenDocEditor({
  surfaceKey,
  chromeRole,
  value,
  onChange,
  editable = true,
  placeholder = null,
  className,
  enableDragHandle = false,
}: HeartgardenDocEditorProps) {
  const extensions = useMemo(
    () =>
      getHgDocExtensions({
        placeholder: placeholder ?? "Write here, or type / for blocks…",
        withPlaceholder: true,
      }),
    [],
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable,
      extensions,
      content: value?.type === "doc" ? value : EMPTY_HG_DOC,
      editorProps: {
        attributes: {
          class: styles.proseRoot,
          spellcheck: "false",
        },
      },
      onUpdate: ({ editor: ed }) => {
        onChange?.(ed.getJSON());
      },
    },
    [],
  );

  useEffect(() => {
    if (!editor) return;
    const next = value?.type === "doc" ? value : EMPTY_HG_DOC;
    const cur = editor.getJSON();
    if (JSON.stringify(cur) === JSON.stringify(next)) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const api: HgDocEditorApi = {
      runFormat: (command, v) => applyHgDocFormatCommand(editor, command, v),
      getFormatState: () => readHgDocFormatChrome(editor),
      getJSON: () => editor.getJSON(),
      focus: () => {
        editor.commands.focus();
      },
      insertImageFromDataUrl: (src, alt) => {
        editor.chain().focus().setImage({ src, alt: alt || "" }).run();
      },
    };
    registerHgDocEditor(surfaceKey, api);
    return () => registerHgDocEditor(surfaceKey, null);
  }, [editor, surfaceKey]);

  if (!editor) return null;

  const dataAttrs =
    chromeRole === "focus"
      ? { "data-focus-body-editor": "true" as const }
      : { "data-node-body-editor": "true" as const };

  return (
    <div
      className={`${styles.host} ${className ?? ""}`.trim()}
      data-hg-doc-editor="true"
      data-hg-doc-surface={surfaceKey}
      {...dataAttrs}
    >
      {enableDragHandle ? (
        <DragHandle editor={editor} className={styles.dragHandle}>
          <DotsSixVertical aria-hidden size={14} weight="bold" />
        </DragHandle>
      ) : null}
      <EditorContent editor={editor} className={styles.editorContent} />
    </div>
  );
}
