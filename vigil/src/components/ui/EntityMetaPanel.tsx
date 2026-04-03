"use client";

import { VIGIL_METADATA_LABEL } from "@/src/lib/vigil-ui-classes";
import type { CanvasItem } from "@/src/stores/canvas-types";
import { BufferedTextInput } from "@/src/components/editing/BufferedTextInput";

const FIELDS: Record<
  string,
  { key: string; label: string; kind: "text" | "date" }[]
> = {
  character: [
    { key: "race", label: "Race", kind: "text" },
    { key: "class", label: "Class / role", kind: "text" },
    { key: "pronouns", label: "Pronouns", kind: "text" },
    { key: "allegiances", label: "Allegiances", kind: "text" },
  ],
  location: [
    { key: "region", label: "Region", kind: "text" },
    { key: "terrain", label: "Terrain", kind: "text" },
    { key: "climate", label: "Climate", kind: "text" },
    { key: "population", label: "Population", kind: "text" },
    { key: "ruler", label: "Ruler", kind: "text" },
  ],
  faction: [
    { key: "alignment", label: "Alignment", kind: "text" },
    { key: "goals", label: "Goals", kind: "text" },
  ],
  event: [
    { key: "eventDate", label: "When", kind: "date" },
    { key: "era", label: "Era / arc", kind: "text" },
  ],
  item: [{ key: "rarity", label: "Rarity", kind: "text" }],
  lore: [{ key: "era", label: "Era", kind: "text" }],
};

function readMeta(item: CanvasItem): Record<string, unknown> {
  const m = item.entityMeta;
  return m && typeof m === "object" && !Array.isArray(m)
    ? { ...m }
    : {};
}

export function EntityMetaPanel({
  item,
  onPatchItem,
}: {
  item: CanvasItem;
  onPatchItem: (id: string, patch: Partial<CanvasItem>) => void;
}) {
  const et = item.entityType?.trim() ?? "";
  const fields = FIELDS[et];
  if (!fields?.length) return null;

  const persist = (next: Record<string, unknown>) => {
    onPatchItem(item.id, { entityMeta: next });
  };

  return (
    <div className="mt-2.5 flex max-h-[min(40vh,220px)] flex-col gap-2.5 overflow-y-auto border-t border-[var(--vigil-border)] pt-2.5">
      {fields.map((f) => {
        const meta = readMeta(item);
        const raw = meta[f.key];
        const initial =
          f.kind === "date" && typeof raw === "string"
            ? raw.slice(0, 10)
            : String(raw ?? "");

        return (
          <label
            key={f.key}
            className="flex flex-col gap-0.5 text-[var(--vigil-label)]"
          >
            <span className={VIGIL_METADATA_LABEL}>{f.label}</span>
            <BufferedTextInput
              data-entity-meta-field={f.key}
              type={f.kind === "date" ? "date" : "text"}
              className="rounded border border-[var(--vigil-border)] bg-[var(--background)] px-2 py-1 text-[11px] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vigil-snap)]/35"
              value={initial}
              debounceMs={220}
              normalizeOnCommit={(next) => next.trim()}
              onCommit={(nextValue) => {
                const v = nextValue.trim();
                const next = readMeta(item);
                if (v) next[f.key] = v;
                else delete next[f.key];
                persist(next);
              }}
            />
          </label>
        );
      })}
    </div>
  );
}
