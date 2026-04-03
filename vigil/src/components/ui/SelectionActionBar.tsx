"use client";

import { Copy, Trash } from "@phosphor-icons/react";

import { Button } from "@/src/components/ui/Button";
import {
  VIGIL_CHROME_ICON,
  VIGIL_GLASS_PANEL,
} from "@/src/lib/vigil-ui-classes";
import { useCanvasStore } from "@/src/stores/canvas-store";
import type { CanvasItem } from "@/src/stores/canvas-types";

export function SelectionActionBar({
  onDuplicate,
  onDelete,
}: {
  onDuplicate: (items: CanvasItem[]) => void;
  onDelete: (ids: string[]) => void;
}) {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const itemsRecord = useCanvasStore((s) => s.items);

  if (selectedIds.length === 0) return null;

  const selected = selectedIds
    .map((id) => itemsRecord[id])
    .filter(Boolean) as CanvasItem[];

  return (
    <div
      className={`pointer-events-auto fixed bottom-5 left-1/2 z-[850] flex -translate-x-1/2 flex-wrap items-center gap-2 px-3 py-2 ${VIGIL_GLASS_PANEL}`}
      role="toolbar"
      aria-label="Selection actions"
    >
      <span className="px-1 text-xs text-[var(--vigil-muted)]">
        {selectedIds.length} selected
      </span>
      <Button size="md" variant="neutral" tone="glass" onClick={() => onDuplicate(selected)}>
        <Copy className={VIGIL_CHROME_ICON} weight="bold" aria-hidden />
        Duplicate
      </Button>
      <Button size="md" variant="danger" tone="glass" onClick={() => onDelete([...selectedIds])}>
        <Trash className={VIGIL_CHROME_ICON} weight="bold" aria-hidden />
        Delete
      </Button>
    </div>
  );
}
