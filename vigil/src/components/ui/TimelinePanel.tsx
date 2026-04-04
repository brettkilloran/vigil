"use client";

import { CalendarDots, X } from "@phosphor-icons/react";
import { useMemo } from "react";

import { Button } from "@/src/components/ui/Button";
import {
  HEARTGARDEN_GLASS_PANEL,
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
      className={`pointer-events-auto fixed bottom-3 left-1/2 z-[900] max-h-[min(40vh,320px)] w-[min(96vw,420px)] -translate-x-1/2 overflow-hidden p-3 ${HEARTGARDEN_GLASS_PANEL}`}
      role="dialog"
      aria-label="Event timeline"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[var(--vigil-label)]">
          <CalendarDots
            className="size-4 shrink-0 text-[var(--vigil-muted)] opacity-90"
            weight="bold"
            aria-hidden
          />
          Events (TTRPG)
        </span>
        <Button
          size="icon"
          variant="ghost"
          tone="glass"
          aria-label="Close timeline"
          onClick={onClose}
        >
          <X className="size-4" weight="bold" aria-hidden />
        </Button>
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
                <Button
                  size="sm"
                  variant="subtle"
                  tone="menu"
                  className="flex w-full items-baseline justify-start gap-2"
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
                </Button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
