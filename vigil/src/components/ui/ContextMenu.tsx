"use client";

import { useEffect, useRef } from "react";

export function ContextMenu({
  position,
  onClose,
  items,
}: {
  position: { x: number; y: number } | null;
  onClose: () => void;
  items: { label: string; onSelect: () => void }[];
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
      className="fixed z-[1100] min-w-[192px] rounded-xl border border-[var(--vigil-border)] bg-[var(--vigil-elevated)]/95 py-1 shadow-xl shadow-black/12 backdrop-blur-xl dark:shadow-black/45"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          className="block w-full px-3 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:bg-black/[0.06] focus-visible:bg-black/[0.06] focus-visible:outline-none dark:hover:bg-white/[0.08] dark:focus-visible:bg-white/[0.08]"
          onClick={() => {
            it.onSelect();
            onClose();
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
