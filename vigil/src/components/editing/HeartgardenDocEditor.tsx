"use client";

import { offset } from "@floating-ui/dom";

import { DotsSixVertical } from "@phosphor-icons/react";

import type { Editor, JSONContent } from "@tiptap/core";

import DragHandle from "@tiptap/extension-drag-handle-react";

import type { Node as PmNode } from "@tiptap/pm/model";

import { EditorContent, useEditor } from "@tiptap/react";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { EMPTY_HG_DOC } from "@/src/lib/hg-doc/constants";

import type { HgDocEditorApi } from "@/src/lib/hg-doc/editor-registry";

import { registerHgDocEditor } from "@/src/lib/hg-doc/editor-registry";

import { getHgDocExtensions } from "@/src/lib/hg-doc/extensions";

import {
  applyHgDocFormatCommand,
  readHgDocFormatChrome,
} from "@/src/lib/hg-doc/tiptap-format";

import styles from "@/src/components/editing/HeartgardenDocEditor.module.css";

/** Stable floating-ui config for DragHandle (avoid churning the TipTap extension on parent re-render). */

const HG_DOC_DRAG_HANDLE_FLOAT = {
  placement: "left-start" as const,
  /* `absolute` is clipped by `.focusSheet { overflow-y: auto }` (horizontal overflow becomes non-visible). */
  strategy: "fixed" as const,
  middleware: [
    /* Sit in the left gutter; slight vertical nudge toward first-line cap height. */
    offset({ mainAxis: 4, crossAxis: -1 }),
  ],
};

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
  const dragRowHoverElRef = useRef<HTMLElement | null>(null);

  const clearDragRowHover = useCallback(() => {
    dragRowHoverElRef.current?.classList.remove(styles.rowDragHover);

    dragRowHoverElRef.current = null;
  }, []);

  const extensions = useMemo(
    () =>
      getHgDocExtensions({
        placeholder: placeholder ?? "Write here, or type / for blocks…",

        withPlaceholder: true,
      }),

    [placeholder],
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

    [extensions],
  );

  const onDragHandleNodeChange = useCallback(
    ({
      node,
      editor: ed,
      pos,
    }: {
      node: PmNode | null;
      editor: Editor;
      pos: number | null;
    }) => {
      clearDragRowHover();

      if (!node || pos == null) return;

      const dom = ed.view.nodeDOM(pos);

      if (dom instanceof HTMLElement) {
        dom.classList.add(styles.rowDragHover);

        dragRowHoverElRef.current = dom;
      }
    },

    [clearDragRowHover],
  );

  const onDragHandleDragEnd = useCallback(() => {
    clearDragRowHover();
  }, [clearDragRowHover]);

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
    return () => {
      clearDragRowHover();
    };
  }, [clearDragRowHover]);

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
        <DragHandle
          editor={editor}
          className={styles.dragHandle}
          computePositionConfig={HG_DOC_DRAG_HANDLE_FLOAT}
          onNodeChange={onDragHandleNodeChange}
          onElementDragEnd={onDragHandleDragEnd}
        >
          <span className={styles.dragHandleIcon}>
            <DotsSixVertical aria-hidden size={14} weight="bold" />
          </span>
        </DragHandle>
      ) : null}

      <EditorContent editor={editor} className={styles.editorContent} />
    </div>
  );
}
