"use client";

import { Button } from "@/src/components/ui/Button";

type MentionRow = {
  itemId: string;
  title: string;
  mentionCount: number;
  snippet?: string | null;
};

export function EntityPopover({
  open,
  term,
  x,
  y,
  rows,
  loading,
  onClose,
  onShowItem,
}: {
  open: boolean;
  term: string;
  x: number;
  y: number;
  rows: MentionRow[];
  loading: boolean;
  onClose: () => void;
  onShowItem: (itemId: string) => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed z-[2100] w-[340px] rounded-lg border border-[var(--vigil-border)] bg-[var(--vigil-surface)] p-2 shadow-2xl"
      style={{ left: x, top: y }}
      onMouseLeave={onClose}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.16em] text-[var(--vigil-label)]">
          Entity mention
        </div>
        <Button size="sm" variant="ghost" tone="menu" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="mb-2 text-sm font-semibold">{term}</div>
      {loading ? <div className="text-xs text-[var(--vigil-muted)]">Loading...</div> : null}
      <ul className="space-y-1">
        {rows.slice(0, 6).map((row) => (
          <li key={row.itemId} className="rounded border border-[var(--vigil-border)] p-2">
            <Button
              size="sm"
              variant="subtle"
              tone="menu"
              className="w-full justify-start truncate"
              onClick={() => onShowItem(row.itemId)}
            >
              {row.title}
              <span className="ml-1 text-[var(--vigil-muted)]">({row.mentionCount})</span>
            </Button>
            {row.snippet ? (
              <div className="mt-1 line-clamp-2 text-xs text-[var(--vigil-muted)]">{row.snippet}</div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
