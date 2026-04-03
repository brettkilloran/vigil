"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { useEffect } from "react";

import type { CanvasItem } from "@/src/stores/canvas-types";

type JSONDoc = Record<string, unknown>;

function emptyDoc(): JSONDoc {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [] }],
  };
}

export function NoteCard({
  item,
  onPersist,
  active,
}: {
  item: CanvasItem;
  onPersist: (patch: {
    contentJson?: JSONDoc | null;
    contentText?: string;
    title?: string;
  }) => void;
  active: boolean;
}) {
  const initial = (item.contentJson as JSONDoc | null) ?? emptyDoc();

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({
        placeholder: "Write something…",
      }),
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: initial,
    editable: active,
    editorProps: {
      attributes: {
        class: "max-w-none text-sm leading-relaxed focus:outline-none min-h-[120px] px-3 py-2 text-[var(--foreground)]",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON() as JSONDoc;
      const text = ed.getText();
      const title = text.trim().split(/\n/)[0]?.slice(0, 255) || "Note";
      onPersist({ contentJson: json, contentText: text, title });
    },
  });

  useEffect(() => {
    editor?.setEditable(active);
  }, [active, editor]);

  useEffect(() => {
    if (!editor) return;
    const next = (item.contentJson as JSONDoc | null) ?? emptyDoc();
    const cur = editor.getJSON() as JSONDoc;
    if (JSON.stringify(cur) !== JSON.stringify(next)) {
      editor.commands.setContent(next, false);
    }
  }, [editor, item.contentJson, item.id]);

  return <EditorContent editor={editor} />;
}
