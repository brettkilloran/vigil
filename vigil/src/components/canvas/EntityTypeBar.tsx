"use client";

import { EntityMetaPanel } from "@/src/components/ui/EntityMetaPanel";
import { VIGIL_GLASS_PANEL } from "@/src/lib/vigil-ui-classes";
import { useCanvasStore } from "@/src/stores/canvas-store";
import type { CanvasItem } from "@/src/stores/canvas-types";

const ENTITY_TYPES = [
  { value: "", label: "General note" },
  { value: "character", label: "Character" },
  { value: "location", label: "Location" },
  { value: "faction", label: "Faction" },
  { value: "event", label: "Event" },
  { value: "item", label: "Item" },
  { value: "lore", label: "Lore" },
] as const;

export function EntityTypeBar({
  onPatchItem,
}: {
  onPatchItem: (id: string, patch: Partial<CanvasItem>) => void;
}) {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const items = useCanvasStore((s) => s.items);

  if (selectedIds.length !== 1) return null;
  const it = items[selectedIds[0]!];
  if (!it || it.itemType !== "note") return null;

  return (
    <div
      className={`pointer-events-auto absolute left-3 top-[132px] z-[800] flex max-w-[240px] flex-col px-2.5 py-2 text-xs ${VIGIL_GLASS_PANEL}`}
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[var(--vigil-muted)]">TTRPG</span>
        <select
          className="min-w-0 flex-1 rounded-lg border border-[var(--vigil-border)] bg-[var(--vigil-btn-bg)] px-1.5 py-0.5 text-[var(--foreground)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vigil-snap)]/40"
          value={it.entityType ?? ""}
          onChange={(e) => {
            const v = e.target.value || null;
            onPatchItem(it.id, { entityType: v });
          }}
        >
          {ENTITY_TYPES.map((o) => (
            <option key={o.value || "none"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <EntityMetaPanel item={it} onPatchItem={onPatchItem} />
    </div>
  );
}
