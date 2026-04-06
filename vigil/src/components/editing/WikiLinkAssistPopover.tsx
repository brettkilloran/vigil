"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/src/components/ui/Button";
import { getVigilPortalRoot } from "@/src/lib/dom-portal-root";

export type WikiCandidate = { id: string; title: string };

export function WikiLinkAssistPopover({
  open,
  anchorRect,
  candidates,
  activeIndex,
  onPick,
  onClose,
}: {
  open: boolean;
  anchorRect: DOMRect | null;
  candidates: WikiCandidate[];
  activeIndex: number;
  onPick: (c: WikiCandidate) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  const pos = useMemo(() => {
    if (!anchorRect) return { top: 0, left: 0 };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = 280;
    const rowH = 44;
    const ph = Math.min(8 + Math.max(1, candidates.length) * rowH, 208);
    let top = anchorRect.bottom + 6;
    let left = anchorRect.left;
    if (top + ph > vh - 8) top = Math.max(8, anchorRect.top - ph - 6);
    if (left + pw > vw - 8) left = Math.max(8, vw - pw - 8);
    if (left < 8) left = 8;
    return { top, left };
  }, [anchorRect, candidates.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);

  if (!open || !anchorRect || candidates.length === 0) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[12000] max-h-52 w-[min(280px,calc(100vw-24px))] overflow-auto rounded-lg border border-[var(--vigil-border)] bg-[var(--vigil-panel)] py-1 shadow-xl"
      style={{ top: pos.top, left: pos.left }}
      role="listbox"
      aria-label="Link target"
    >
      {candidates.map((c, i) => (
        <Button
          key={c.id}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          variant={i === activeIndex ? "primary" : "subtle"}
          tone="menu"
          size="sm"
          className="w-full justify-start rounded-none px-3 py-2 text-left"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(c)}
        >
          <span className="truncate">{c.title || "Untitled"}</span>
          <span className="ml-2 shrink-0 text-[10px] text-[var(--vigil-muted)]">{c.id.slice(0, 8)}…</span>
        </Button>
      ))}
    </div>,
    getVigilPortalRoot(),
  );
}
