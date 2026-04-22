"use client";

import type { JSONContent } from "@tiptap/core";

import { EditorContent, useEditor } from "@tiptap/react";

import { useEffect, useMemo, useRef } from "react";

import { HgDocPointerBlockDrag } from "@/src/components/editing/HgDocPointerBlockDrag";
import { HgAiPendingEditorGutter } from "@/src/components/editing/HgAiPendingEditorGutter";

import { EMPTY_HG_DOC } from "@/src/lib/hg-doc/constants";

import type { HgDocEditorApi } from "@/src/lib/hg-doc/editor-registry";

import { registerHgDocEditor } from "@/src/lib/hg-doc/editor-registry";

import { getHgDocExtensions } from "@/src/lib/hg-doc/extensions";

import {
  applyHgDocFormatCommand,
  readHgDocFormatChrome,
} from "@/src/lib/hg-doc/tiptap-format";

import styles from "@/src/components/editing/HeartgardenDocEditor.module.css";

function docJsonKey(doc: JSONContent): string {
  try {
    return JSON.stringify(doc);
  } catch {
    return "";
  }
}

export type HeartgardenDocChromeRole = "focus" | "canvas";

export type HeartgardenDocEditorProps = {
  surfaceKey: string;

  chromeRole: HeartgardenDocChromeRole;

  value: JSONContent;

  onChange?: (doc: JSONContent) => void;

  editable?: boolean;

  placeholder?: string | null;

  className?: string;

  /** Block reorder grip — **focus / document sheet only**; ignored when `chromeRole="canvas"`. */
  enableDragHandle?: boolean;

  /** Syntax token colors tuned for dark code panels (snippet focus + canvas code cards). */
  codeSyntaxDark?: boolean;

  /** Right margin: one Bind control per pending AI span (hgAiPending mark). Default true. */
  showAiPendingGutter?: boolean;
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

  codeSyntaxDark = false,

  showAiPendingGutter = true,
}: HeartgardenDocEditorProps) {
  const gutterWrapRef = useRef<HTMLDivElement | null>(null);

  const extensions = useMemo(
    () =>
      getHgDocExtensions({
        placeholder: placeholder ?? "Write here, or type / for blocks…",

        withPlaceholder: true,
      }),

    [placeholder],
  );

  const hostRef = useRef<HTMLDivElement | null>(null);
  const currentEditorDocKeyRef = useRef<string>(
    docJsonKey(value?.type === "doc" ? value : EMPTY_HG_DOC),
  );

  const showBlockDragHandle = Boolean(enableDragHandle && chromeRole === "focus");

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
        const nextDoc = ed.getJSON();
        currentEditorDocKeyRef.current = docJsonKey(nextDoc);
        onChange?.(nextDoc);
      },
    },

    [extensions],
  );

  useEffect(() => {
    if (!editor) return;

    const next = value?.type === "doc" ? value : EMPTY_HG_DOC;
    const nextKey = docJsonKey(next);
    if (currentEditorDocKeyRef.current === nextKey) return;
    currentEditorDocKeyRef.current = nextKey;

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
        editor
          .chain()
          .focus()
          .setImage({ src, alt: alt || "" })
          .run();
      },

      undo: () => editor.commands.undo(),

      redo: () => editor.commands.redo(),

      canUndo: () => editor.can().undo(),

      canRedo: () => editor.can().redo(),

      isEmptyDocument: () => editor.isEmpty,
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
      ref={hostRef}
      className={`${styles.host} ${className ?? ""}`.trim()}
      data-hg-doc-editor="true"
      data-hg-doc-surface={surfaceKey}
      {...(codeSyntaxDark ? { "data-hg-doc-syntax": "dark" as const } : {})}
      {...dataAttrs}
    >
      {showBlockDragHandle ? (
        <HgDocPointerBlockDrag editor={editor} hostRef={hostRef} chromeRole={chromeRole} enabled />
      ) : null}
      {showAiPendingGutter ? (
        <div className={styles.editorGutterRow} ref={gutterWrapRef}>
          <div className={styles.editorColumn}>
            <EditorContent editor={editor} className={styles.editorContent} />
          </div>
          <HgAiPendingEditorGutter editor={editor} wrapRef={gutterWrapRef} />
        </div>
      ) : (
        <EditorContent editor={editor} className={styles.editorContent} />
      )}
    </div>
  );
}
