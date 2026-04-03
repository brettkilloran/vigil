"use client";

import { CalendarDays, X } from "lucide-react";
import { useMemo } from "react";

import {
  VIGIL_GLASS_PANEL,
  VIGIL_ICON_GHOST_BTN,
} from "@/src/lib/vigil-ui-classes";
import { useCanvasStore } from "@/src/stores/canvas-store";
import type { CanvasItem } from "@/src/stores/canvas-types";

function parseEventDate(meta: Record<string, unknown> | null | undefined): number {
  const raw = meta?.eventDate;
  if (typeof raw !== "string" || !raw.trim()) return Number.POSITIVE_INFINITY;
  const t = Date.parse(raw.includes("T") ? raw : `${raw}T12:00:00`);
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

export function TimelinePanel({
  open,
  onClose,
  onSelectItem,
}: {
  open: boolean;
  onClose: () => void;
  onSelectItem: (id: string) => void;
}) {
  const itemsRecord = useCanvasStore((s) => s.items);

  const events = useMemo(() => {
    const list: CanvasItem[] = [];
    for (const it of Object.values(itemsRecord)) {
      if (it.entityType === "event") list.push(it);
    }
    return list.sort(
      (a, b) =>
        parseEventDate(a.entityMeta as Record<string, unknown>) -
        parseEventDate(b.entityMeta as Record<string, unknown>),
    );
  }, [itemsRecord]);

  if (!open) return null;

  return (
    <div
      className={`pointer-events-auto fixed bottom-3 left-1/2 z-[900] max-h-[min(40vh,320px)] w-[min(96vw,420px)] -translate-x-1/2 overflow-hidden p-3 ${VIGIL_GLASS_PANEL}`}
      role="dialog"
      aria-label="Event timeline"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[var(--vigil-label)]">
          <CalendarDays
            className="size-4 shrink-0 text-[var(--vigil-muted)] opacity-90"
            aria-hidden
          />
          Events (TTRPG)
        </span>
        <button
          type="button"
          className={VIGIL_ICON_GHOST_BTN}
          aria-label="Close timeline"
          onClick={onClose}
        >
          <X className="size-4" strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      <ul className="max-h-[min(36vh,280px)] overflow-y-auto py-0.5 text-xs">
        {events.length === 0 ? (
          <li className="px-1 py-2.5 text-[var(--vigil-muted)]">
            No items tagged as <strong>Event</strong> with optional dates in TTRPG
            metadata.
          </li>
        ) : (
          events.map((it) => {
            const meta = it.entityMeta as Record<string, unknown> | undefined;
            const when =
              typeof meta?.eventDate === "string" && meta.eventDate
                ? meta.eventDate.slice(0, 10)
                : "—";
            return (
              <li key={it.id}>
                <button
                  type="button"
                  className="flex w-full items-baseline gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vigil-snap)]/35 dark:hover:bg-white/[0.08]"
                  onClick={() => {
                    onSelectItem(it.id);
                    onClose();
                  }}
                >
                  <span className="w-[88px] shrink-0 font-mono text-[10px] text-[var(--vigil-muted)]">
                    {when}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-[var(--foreground)]">
                    {it.title || "Event"}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
