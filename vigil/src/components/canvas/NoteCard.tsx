"use client";

import type { Editor } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { extractVigilItemLinkTargets } from "@/src/lib/extract-vigil-item-links";
import { useModKeyHints } from "@/src/lib/mod-keys";
import {
  VIGIL_EDITOR_TOOLBAR_BTN,
  VIGIL_EDITOR_TOOLBAR_BTN_ON,
} from "@/src/lib/vigil-ui-classes";
import { getWikiLinkRangeFromState } from "@/src/lib/wiki-link-range";
import type { CanvasItem } from "@/src/stores/canvas-types";

type JSONDoc = Record<string, unknown>;

type WikiCtxState = {
  from: number;
  to: number;
  query: string;
  left: number;
  top: number;
} | null;

function syncWikiFromEditor(
  ed: Editor,
  setWikiCtx: (v: WikiCtxState) => void,
) {
  const r = getWikiLinkRangeFromState(ed.state);
  if (!r) {
    setWikiCtx(null);
    return;
  }
  try {
    const c = ed.view.coordsAtPos(r.to);
    setWikiCtx({
      ...r,
      left: c.left,
      top: c.bottom + 4,
    });
  } catch {
    setWikiCtx(null);
  }
}

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

function NoteFormatToolbar({ editor }: { editor: Editor | null }) {
  const hints = useModKeyHints();
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!editor) return;
    const u = () => bump();
    editor.on("selectionUpdate", u);
    editor.on("transaction", u);
    return () => {
      editor.off("selectionUpdate", u);
      editor.off("transaction", u);
    };
  }, [editor]);

  if (!editor) return null;

  const btn = VIGIL_EDITOR_TOOLBAR_BTN;
  const on = VIGIL_EDITOR_TOOLBAR_BTN_ON;

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 border-b border-[var(--vigil-card-border)] bg-[var(--vigil-card-header-bg)] px-2 py-2"
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        title={`Bold (${hints.bold})`}
        className={`${btn} ${editor.isActive("bold") ? on : ""}`}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </button>
      <button
        type="button"
        title={`Italic (${hints.italic})`}
        className={`${btn} italic ${editor.isActive("italic") ? on : ""}`}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        I
      </button>
      <button
        type="button"
        title={`Underline (${hints.underline})`}
        className={`${btn} underline ${editor.isActive("underline") ? on : ""}`}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        U
      </button>
      <button
        type="button"
        title="Strikethrough"
        className={`${btn} line-through ${editor.isActive("strike") ? on : ""}`}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        S
      </button>
      <button
        type="button"
        title="Inline code"
        className={`${btn} font-mono text-[10px] ${editor.isActive("code") ? on : ""}`}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        {"</>"}
      </button>
      <button
        type="button"
        title="Highlight"
        className={`${btn} ${editor.isActive("highlight") ? on : ""}`}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      >
        Hi
      </button>
      <span className="mx-0.5 text-[var(--vigil-muted)]">|</span>
      <button
        type="button"
        title="Heading 2"
        className={`${btn} ${editor.isActive("heading", { level: 2 }) ? on : ""}`}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
      >
        H2
      </button>
      <button
        type="button"
        title="Bullet list"
        className={`${btn} ${editor.isActive("bulletList") ? on : ""}`}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        • List
      </button>
      <button
        type="button"
        title="Numbered list"
        className={`${btn} ${editor.isActive("orderedList") ? on : ""}`}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1. List
      </button>
    </div>
  );
}

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
  const [wikiCtx, setWikiCtx] = useState<WikiCtxState>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Highlight.configure({
        multicolor: false,
        HTMLAttributes: {
          class:
            "rounded-sm bg-amber-200/90 px-0.5 dark:bg-amber-500/40",
        },
      }),
      Placeholder.configure({
        placeholder:
          "Write something… Type [[ to link another card, or use the picker above.",
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
      handleKeyDown(view, event) {
        if (event.key === "Escape") {
          const r = getWikiLinkRangeFromState(view.state);
          if (r) {
            event.preventDefault();
            view.dispatch(view.state.tr.deleteRange(r.from, r.to));
            setWikiCtx(null);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON() as JSONDoc;
      const text = ed.getText();
      const title = text.trim().split(/\n/)[0]?.slice(0, 255) || "Note";
      onPersist({ contentJson: json, contentText: text, title });
      scheduleLinkSync(json);

      syncWikiFromEditor(ed, setWikiCtx);
    },
  });

  useEffect(() => {
    editor?.setEditable(active);
  }, [active, editor]);

  useEffect(() => {
    if (!editor || !active) return;
    const onSel = () => syncWikiFromEditor(editor, setWikiCtx);
    editor.on("selectionUpdate", onSel);
    editor.on("focus", onSel);
    return () => {
      editor.off("selectionUpdate", onSel);
      editor.off("focus", onSel);
      setWikiCtx(null);
    };
  }, [editor, active]);

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
    const others = peerItems.filter((p) => p.id !== item.id);
    if (!q) return others.slice(0, 8);
    return others
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.contentText.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [linkQ, peerItems, item.id]);

  const wikiPeers = useMemo(() => {
    const q = wikiCtx?.query.trim().toLowerCase() ?? "";
    const others = peerItems.filter((p) => p.id !== item.id);
    if (!q) return others.slice(0, 8);
    return others
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.contentText.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [wikiCtx?.query, peerItems, item.id]);

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

  const insertWikiLink = (target: CanvasItem, range: { from: number; to: number }) => {
    if (!editor) return;
    const href = `vigil:item:${target.id}`;
    editor
      .chain()
      .focus()
      .deleteRange({ from: range.from, to: range.to })
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
    setWikiCtx(null);
  };

  return (
    <>
    <div className="flex h-full min-h-0 flex-col bg-[var(--vigil-card-bg)]">
      {active && peerItems.some((p) => p.id !== item.id) ? (
        <div className="flex flex-col gap-1 border-b border-black/5 px-2 py-1 dark:border-white/10">
          <input
            type="search"
            className="w-full rounded border border-[var(--vigil-border)] bg-[var(--vigil-btn-bg)] px-1.5 py-0.5 text-[11px] text-[var(--foreground)]"
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
      {active ? <NoteFormatToolbar editor={editor} /> : null}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--vigil-card-bg)]">
        <EditorContent editor={editor} />
      </div>
    </div>
    {wikiCtx && active ? (
      <div
        className="fixed z-[950] max-h-36 min-w-[200px] max-w-xs overflow-y-auto rounded-md border border-[var(--vigil-border)] bg-[var(--vigil-btn-bg)] p-1 text-xs shadow-lg"
        style={{ left: wikiCtx.left, top: wikiCtx.top }}
        role="menu"
        aria-label="Link to item"
      >
        {wikiPeers.length === 0 ? (
          <p className="px-2 py-1 text-[var(--vigil-muted)]">
            No matching items. Keep typing or Esc to cancel.
          </p>
        ) : (
          wikiPeers.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitem"
              className="flex w-full truncate rounded px-2 py-1 text-left hover:bg-black/5 dark:hover:bg-white/10"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                insertWikiLink(p, { from: wikiCtx.from, to: wikiCtx.to })
              }
            >
              {p.title}
            </button>
          ))
        )}
      </div>
    ) : null}
    </>
  );
}
