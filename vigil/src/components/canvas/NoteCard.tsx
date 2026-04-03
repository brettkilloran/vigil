"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { extractVigilItemLinkTargets } from "@/src/lib/extract-vigil-item-links";
import type { CanvasItem } from "@/src/stores/canvas-types";

type JSONDoc = Record<string, unknown>;

function emptyDoc(): JSONDoc {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [] }],
  };
}

const linkExt = Link.configure({
  openOnClick: false,
  autolink: false,
  protocols: [{ scheme: "vigil", optionalSlashes: false }],
  isAllowedUri: (url, ctx) => {
    if (url.startsWith("vigil:item:")) return true;
    return ctx.defaultValidate(url);
  },
  HTMLAttributes: {
    class: "vigil-item-link underline decoration-[var(--vigil-snap)]/70",
  },
});

export function NoteCard({
  item,
  onPersist,
  active,
  peerItems,
  cloudSyncLinks,
}: {
  item: CanvasItem;
  onPersist: (patch: {
    contentJson?: JSONDoc | null;
    contentText?: string;
    title?: string;
  }) => void;
  active: boolean;
  peerItems: CanvasItem[];
  cloudSyncLinks: boolean;
}) {
  const initial = (item.contentJson as JSONDoc | null) ?? emptyDoc();
  const [linkQ, setLinkQ] = useState("");
  const syncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({
        placeholder: "Write something… Type [[ or use Link to cite another card.",
      }),
      linkExt,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    [],
  );

  const scheduleLinkSync = useCallback(
    (doc: JSONDoc) => {
      if (!cloudSyncLinks) return;
      clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        const targetIds = extractVigilItemLinkTargets(doc);
        void fetch("/api/item-links/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceItemId: item.id,
            targetIds,
          }),
        });
      }, 700);
    },
    [cloudSyncLinks, item.id],
  );

  useEffect(() => {
    return () => clearTimeout(syncTimer.current);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
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
      scheduleLinkSync(json);
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

  const filteredPeers = useMemo(() => {
    const q = linkQ.trim().toLowerCase();
    if (!q) return peerItems.slice(0, 8);
    return peerItems
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.contentText.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [linkQ, peerItems]);

  const insertItemLink = (target: CanvasItem) => {
    if (!editor) return;
    const href = `vigil:item:${target.id}`;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "text",
        text: target.title || "Note",
        marks: [
          {
            type: "link",
            attrs: { href, target: null },
          },
        ],
      })
      .insertContent(" ")
      .run();
    setLinkQ("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {active && peerItems.length > 0 ? (
        <div className="flex flex-col gap-1 border-b border-black/5 px-2 py-1 dark:border-white/10">
          <input
            type="search"
            className="w-full rounded border border-[var(--vigil-border)] bg-[var(--background)] px-1.5 py-0.5 text-[11px] text-[var(--foreground)]"
            placeholder="Link to item…"
            value={linkQ}
            onChange={(e) => setLinkQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filteredPeers[0]) {
                e.preventDefault();
                insertItemLink(filteredPeers[0]!);
              }
            }}
          />
          {linkQ.trim() && filteredPeers.length > 0 ? (
            <div className="flex max-h-20 flex-wrap gap-0.5 overflow-y-auto">
              {filteredPeers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="max-w-full truncate rounded bg-black/5 px-1.5 py-0.5 text-[10px] hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertItemLink(p)}
                >
                  {p.title}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
