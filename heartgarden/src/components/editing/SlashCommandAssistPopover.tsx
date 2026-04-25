"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/src/components/ui/Button";
import type { SlashCommandItem } from "@/src/lib/default-slash-commands";
import { getVigilPortalRoot } from "@/src/lib/dom-portal-root";

export type { SlashCommandItem } from "@/src/lib/default-slash-commands";

export function SlashCommandAssistPopover({
  open,
  anchorRect,
  candidates,
  activeIndex,
  onPick,
  onClose,
}: {
  open: boolean;
  anchorRect: DOMRect | null;
  candidates: SlashCommandItem[];
  activeIndex: number;
  onPick: (item: SlashCommandItem) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  const pos = useMemo(() => {
    if (!anchorRect) {
      return { top: 0, left: 0 };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = 300;
    const rowH = 44;
    const ph = Math.min(
      8 + Math.max(1, candidates.length) * rowH,
      Math.min(320, vh * 0.45)
    );
    let top = anchorRect.bottom + 6;
    let left = anchorRect.left;
    if (top + ph > vh - 8) {
      top = Math.max(8, anchorRect.top - ph - 6);
    }
    if (left + pw > vw - 8) {
      left = Math.max(8, vw - pw - 8);
    }
    if (left < 8) {
      left = 8;
    }
    return { top, left };
  }, [anchorRect, candidates.length]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) {
        return;
      }
      onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);

  if (!(open && anchorRect) || candidates.length === 0) {
    return null;
  }

  return createPortal(
    <div
      aria-label="Insert block"
      className="fixed z-[12000] max-h-[min(320px,45vh)] w-[min(300px,calc(100vw-24px))] overflow-auto rounded-lg border border-[var(--vigil-border)] bg-[var(--vigil-panel)] py-1 shadow-xl"
      ref={panelRef}
      role="listbox"
      style={{ top: pos.top, left: pos.left }}
    >
      {candidates.map((c, i) => (
        <Button
          aria-selected={i === activeIndex}
          className="w-full justify-between gap-2 rounded-none px-3 py-2 text-left"
          key={c.id}
          onClick={() => onPick(c)}
          onMouseDown={(e) => e.preventDefault()}
          role="option"
          size="sm"
          tone="menu"
          type="button"
          variant={i === activeIndex ? "primary" : "subtle"}
        >
          <span className="min-w-0 truncate">{c.label}</span>
          {c.hint ? (
            <span className="shrink-0 text-[10px] text-[var(--vigil-muted)]">
              {c.hint}
            </span>
          ) : null}
        </Button>
      ))}
    </div>,
    getVigilPortalRoot()
  );
}
