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

import { Button } from "@/src/components/ui/Button";
import { getActiveTipTapEditor } from "@/src/lib/tiptap-active-bridge";
import { HEARTGARDEN_GLASS_PANEL } from "@/src/lib/vigil-ui-classes";
import type { ItemType } from "@/src/stores/canvas-types";

/** Chained commands from StarterKit; `getActiveTipTapEditor` returns untyped `Editor`. */
type StarterKitFormatChain = {
  run: () => boolean;
  toggleBold: () => StarterKitFormatChain;
  toggleItalic: () => StarterKitFormatChain;
  toggleBulletList: () => StarterKitFormatChain;
  toggleHeading: (opts: { level: 2 }) => StarterKitFormatChain;
};

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
    const chain = editor.chain().focus() as unknown as StarterKitFormatChain;
    if (action === "bold") chain.toggleBold().run();
    if (action === "italic") chain.toggleItalic().run();
    if (action === "list") chain.toggleBulletList().run();
    if (action === "heading") chain.toggleHeading({ level: 2 }).run();
  };

  return (
    <div className="pointer-events-none fixed bottom-8 left-1/2 z-[800] -translate-x-1/2">
      <div
        className={`pointer-events-auto flex items-center gap-2 px-2 py-2 ${HEARTGARDEN_GLASS_PANEL}`}
      >
        <div className="flex items-center gap-1 pr-1">
          <Button
            size="icon"
            variant="ghost"
            tone="glass"
            aria-label="Bold"
            title="Bold"
            onClick={() => runFmt("bold")}
          >
            <TextB size={16} weight="bold" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            tone="glass"
            aria-label="Italic"
            title="Italic"
            onClick={() => runFmt("italic")}
          >
            <TextItalic size={16} weight="bold" />
          </Button>
          <span className="h-5 w-px bg-[var(--vigil-border)]" aria-hidden />
          <Button
            size="icon"
            variant="ghost"
            tone="glass"
            aria-label="List"
            title="List"
            onClick={() => runFmt("list")}
          >
            <ListBullets size={16} weight="bold" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            tone="glass"
            aria-label="Heading"
            title="Heading"
            onClick={() => runFmt("heading")}
          >
            <TextH size={16} weight="bold" />
          </Button>
        </div>
        <span className="h-6 w-px bg-[var(--vigil-border)]" aria-hidden />
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="subtle"
            tone="menu"
            onClick={() => onCreate("note")}
          >
            <NotePencil size={14} weight="bold" />
            Note
          </Button>
          <Button
            size="sm"
            variant="subtle"
            tone="menu"
            onClick={() => onCreate("checklist")}
          >
            <ListChecks size={14} weight="bold" />
            Task
          </Button>
          <Button
            size="sm"
            variant="subtle"
            tone="menu"
            onClick={() => onCreate("image")}
          >
            <ImageSquare size={14} weight="bold" />
            Image
          </Button>
          <Button
            size="sm"
            variant="subtle"
            tone="menu"
            onClick={() => onCreate("webclip")}
          >
            <LinkSimple size={14} weight="bold" />
            Web clip
          </Button>
        </div>
        <span className="h-6 w-px bg-[var(--vigil-border)]" aria-hidden />
        <Button
          size="icon"
          variant="ghost"
          tone="glass"
          aria-label="Search"
          title="Search"
          onClick={onOpenSearch}
        >
          <MagnifyingGlass size={16} weight="bold" />
        </Button>
      </div>
    </div>
  );
}
