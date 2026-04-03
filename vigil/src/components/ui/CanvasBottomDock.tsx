"use client";

import {
  ListBullets,
  ListChecks,
  MagnifyingGlass,
  NotePencil,
  ImageSquare,
  TextB,
  TextH,
  TextItalic,
  LinkSimple,
} from "@phosphor-icons/react";

import { getActiveTipTapEditor } from "@/src/lib/tiptap-active-bridge";
import {
  VIGIL_ADD_BTN,
  VIGIL_BTN_ICON,
  VIGIL_GLASS_PANEL,
} from "@/src/lib/vigil-ui-classes";
import type { ItemType } from "@/src/stores/canvas-types";

export function CanvasBottomDock({
  onCreate,
  onOpenSearch,
}: {
  onCreate: (kind: ItemType) => void;
  onOpenSearch: () => void;
}) {
  const runFmt = (action: "bold" | "italic" | "list" | "heading") => {
    const editor = getActiveTipTapEditor();
    if (!editor) return;
    const chain = editor.chain().focus();
    if (action === "bold") chain.toggleBold().run();
    if (action === "italic") chain.toggleItalic().run();
    if (action === "list") chain.toggleBulletList().run();
    if (action === "heading") chain.toggleHeading({ level: 2 }).run();
  };

  return (
    <div className="pointer-events-none fixed bottom-8 left-1/2 z-[800] -translate-x-1/2">
      <div
        className={`pointer-events-auto flex items-center gap-2 px-2 py-2 ${VIGIL_GLASS_PANEL}`}
      >
        <div className="flex items-center gap-1 pr-1">
          <button
            type="button"
            className={VIGIL_BTN_ICON}
            aria-label="Bold"
            title="Bold"
            onClick={() => runFmt("bold")}
          >
            <TextB size={16} weight="bold" />
          </button>
          <button
            type="button"
            className={VIGIL_BTN_ICON}
            aria-label="Italic"
            title="Italic"
            onClick={() => runFmt("italic")}
          >
            <TextItalic size={16} weight="bold" />
          </button>
          <span className="h-5 w-px bg-[var(--vigil-border)]" aria-hidden />
          <button
            type="button"
            className={VIGIL_BTN_ICON}
            aria-label="List"
            title="List"
            onClick={() => runFmt("list")}
          >
            <ListBullets size={16} weight="bold" />
          </button>
          <button
            type="button"
            className={VIGIL_BTN_ICON}
            aria-label="Heading"
            title="Heading"
            onClick={() => runFmt("heading")}
          >
            <TextH size={16} weight="bold" />
          </button>
        </div>
        <span className="h-6 w-px bg-[var(--vigil-border)]" aria-hidden />
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={VIGIL_ADD_BTN}
            onClick={() => onCreate("note")}
          >
            <NotePencil size={14} weight="bold" />
            Note
          </button>
          <button
            type="button"
            className={VIGIL_ADD_BTN}
            onClick={() => onCreate("checklist")}
          >
            <ListChecks size={14} weight="bold" />
            Task
          </button>
          <button
            type="button"
            className={VIGIL_ADD_BTN}
            onClick={() => onCreate("image")}
          >
            <ImageSquare size={14} weight="bold" />
            Image
          </button>
          <button
            type="button"
            className={VIGIL_ADD_BTN}
            onClick={() => onCreate("webclip")}
          >
            <LinkSimple size={14} weight="bold" />
            Web clip
          </button>
        </div>
        <span className="h-6 w-px bg-[var(--vigil-border)]" aria-hidden />
        <button
          type="button"
          className={VIGIL_BTN_ICON}
          aria-label="Search"
          title="Search"
          onClick={onOpenSearch}
        >
          <MagnifyingGlass size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}
