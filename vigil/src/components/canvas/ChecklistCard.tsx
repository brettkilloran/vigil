"use client";

import type { Editor } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TiptapUnderline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import {
  Highlighter,
  ListBullets,
  ListChecks,
  ListNumbers,
  TextB,
  TextHTwo,
  TextItalic,
  TextStrikethrough,
  TextUnderline,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { extractVigilItemLinkTargets } from "@/src/lib/extract-vigil-item-links";
import { useModKeyHints } from "@/src/lib/mod-keys";
import { registerActiveTipTapEditor } from "@/src/lib/tiptap-active-bridge";
import type { JSONDoc } from "@/src/lib/tiptap-doc-presets";
import { emptyChecklistDoc } from "@/src/lib/tiptap-doc-presets";
import {
  VIGIL_EDITOR_TOOLBAR_BTN_ON,
  VIGIL_EDITOR_TOOLBAR_ICON_BTN,
} from "@/src/lib/vigil-ui-classes";
import { getWikiLinkRangeFromState } from "@/src/lib/wiki-link-range";
import type { CanvasItem } from "@/src/stores/canvas-types";

import {
  syncWikiFromEditor,
  type WikiCtxState,
} from "./note-wiki-helpers";

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

function ChecklistToolbar({ editor }: { editor: Editor | null }) {
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

  const ic = VIGIL_EDITOR_TOOLBAR_ICON_BTN;
  const on = VIGIL_EDITOR_TOOLBAR_BTN_ON;

  return (
    <div
      className="mx-2 mt-1.5 mb-1 flex flex-wrap items-center gap-0.5 rounded-lg border border-black/10 bg-black/[0.03] px-1 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        className={`${ic} ${editor.isActive("taskList") ? on : ""}`}
        title="Checklist"
        aria-label="Toggle checklist"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListChecks className="size-3.5" weight="bold" />
      </button>
      <button
        type="button"
        className={`${ic} ${editor.isActive("bold") ? on : ""}`}
        title={`Bold (${hints.bold})`}
        aria-label={`Bold (${hints.bold})`}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <TextB className="size-3.5" weight="bold" />
      </button>
      <button
        type="button"
        className={`${ic} ${editor.isActive("italic") ? on : ""}`}
        title={`Italic (${hints.italic})`}
        aria-label={`Italic (${hints.italic})`}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <TextItalic className="size-3.5" weight="bold" />
      </button>
      <button
        type="button"
        className={`${ic} ${editor.isActive("underline") ? on : ""}`}
        title={`Underline (${hints.underline})`}
        aria-label={`Underline (${hints.underline})`}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <TextUnderline className="size-3.5" weight="bold" />
      </button>
      <button
        type="button"
        className={`${ic} ${editor.isActive("strike") ? on : ""}`}
        title="Strikethrough"
        aria-label="Strikethrough"
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <TextStrikethrough className="size-3.5" weight="bold" />
      </button>
      <button
        type="button"
        className={`${ic} ${editor.isActive("highlight") ? on : ""}`}
        title="Highlight"
        aria-label="Highlight"
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      >
        <Highlighter className="size-3.5" weight="bold" />
      </button>
      <button
        type="button"
        className={`${ic} ${editor.isActive("heading", { level: 2 }) ? on : ""}`}
        title="Section heading"
        aria-label="Section heading"
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
      >
        <TextHTwo className="size-3.5" weight="bold" />
      </button>
      <button
        type="button"
        className={`${ic} ${editor.isActive("bulletList") ? on : ""}`}
        title="Bullets (inside task)"
        aria-label="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <ListBullets className="size-3.5" weight="bold" />
      </button>
      <button
        type="button"
        className={`${ic} ${editor.isActive("orderedList") ? on : ""}`}
        title="Numbered list"
        aria-label="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListNumbers className="size-3.5" weight="bold" />
      </button>
    </div>
  );
}

export function ChecklistCard({
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
  const initial = (item.contentJson as JSONDoc | null) ?? emptyChecklistDoc();
  const [linkQ, setLinkQ] = useState("");
  const [wikiCtx, setWikiCtx] = useState<WikiCtxState>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      TiptapUnderline,
      Highlight.configure({
        multicolor: false,
        HTMLAttributes: {
          class:
            "rounded-sm bg-amber-200/90 px-0.5",
        },
      }),
      Placeholder.configure({
        placeholder: "List tasks… Use [[ to link a card.",
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
        class:
          "checklist-editor max-w-none text-sm leading-relaxed focus:outline-none min-h-[120px] px-4 py-3 text-[var(--foreground)]",
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
      const title = text.trim().split(/\n/)[0]?.slice(0, 255) || "Checklist";
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
    registerActiveTipTapEditor(editor);
    return () => {
      registerActiveTipTapEditor(null);
    };
  }, [editor, active]);

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
    const next = (item.contentJson as JSONDoc | null) ?? emptyChecklistDoc();
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
          { type: "link", attrs: { href, target: null } },
        ],
      })
      .insertContent(" ")
      .run();
    setLinkQ("");
  };

  const insertWikiLink = (
    target: CanvasItem,
    range: { from: number; to: number },
  ) => {
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
          { type: "link", attrs: { href, target: null } },
        ],
      })
      .insertContent(" ")
      .run();
    setWikiCtx(null);
  };

  return (
    <>
      <div className="flex h-full min-h-0 flex-col bg-transparent">
        {active && peerItems.some((p) => p.id !== item.id) ? (
          <div className="flex flex-col gap-1 border-b border-black/10 px-2 py-1">
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
                    className="max-w-full truncate rounded bg-black/5 px-1.5 py-0.5 text-[10px] hover:bg-black/10"
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
        {active ? <ChecklistToolbar editor={editor} /> : null}
        <div className="min-h-0 flex-1 overflow-y-auto bg-transparent">
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
                className="flex w-full truncate rounded px-2 py-1 text-left hover:bg-black/5"
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
