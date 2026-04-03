"use client";

import { useCanvasStore } from "@/src/stores/canvas-store";

const ENTITY_TYPES = [
  { value: "", label: "General note" },
  { value: "character", label: "Character" },
  { value: "location", label: "Location" },
  { value: "faction", label: "Faction" },
  { value: "event", label: "Event" },
  { value: "item", label: "Item" },
  { value: "lore", label: "Lore" },
] as const;

export function EntityTypeBar() {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const items = useCanvasStore((s) => s.items);
  const patchItemLocal = useCanvasStore((s) => s.patchItemLocal);

  if (selectedIds.length !== 1) return null;
  const it = items[selectedIds[0]!];
  if (!it || it.itemType !== "note") return null;

  return (
    <div className="pointer-events-auto absolute left-3 top-[120px] z-[800] flex items-center gap-2 rounded-lg border border-[var(--vigil-border)] bg-[var(--vigil-btn-bg)] px-2 py-1.5 text-xs shadow-md">
      <span className="text-[var(--vigil-muted)]">TTRPG</span>
      <select
        className="max-w-[140px] rounded border border-[var(--vigil-border)] bg-[var(--background)] px-1.5 py-0.5 text-[var(--foreground)]"
        value={it.entityType ?? ""}
        onChange={(e) => {
          const v = e.target.value || null;
          patchItemLocal(it.id, { entityType: v });
          const sid = useCanvasStore.getState().spaceId;
          if (sid) {
            void fetch(`/api/items/${it.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ entityType: v }),
            });
          }
        }}
      >
        {ENTITY_TYPES.map((o) => (
          <option key={o.value || "none"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
