"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ContextMenu({
  position,
  onClose,
  items,
}: {
  position: { x: number; y: number } | null;
  onClose: () => void;
  items: { label: string; icon?: ReactNode; onSelect: () => void }[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, position]);

  if (!position) return null;

  return (
    <div
      ref={ref}
      className="fixed z-[1100] min-w-[208px] rounded-xl border border-[var(--vigil-border)] bg-[var(--vigil-elevated)]/95 py-1 shadow-xl shadow-black/12 backdrop-blur-xl dark:shadow-black/45"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-[var(--foreground)] transition-colors hover:bg-black/[0.06] focus-visible:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--vigil-snap)]/25 dark:hover:bg-white/[0.08] dark:focus-visible:bg-white/[0.08]"
          onClick={() => {
            it.onSelect();
            onClose();
          }}
        >
          {it.icon ? <span className="text-[var(--vigil-muted)]">{it.icon}</span> : null}
          <span className="min-w-0 flex-1">{it.label}</span>
        </button>
      ))}
    </div>
  );
}
