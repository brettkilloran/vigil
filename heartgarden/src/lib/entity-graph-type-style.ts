export type EntityTypeStyle = {
  dotColor: string;
  edgeTint: string;
  label: string;
};

const UNKNOWN_STYLE: EntityTypeStyle = {
  dotColor: "oklch(0.79 0.02 255 / 0.82)",
  edgeTint: "oklch(0.79 0.02 255 / 0.56)",
  label: "unknown",
};

const MAP: Record<string, EntityTypeStyle> = {
  character: {
    dotColor: "oklch(0.79 0.11 244 / 0.95)",
    edgeTint: "oklch(0.79 0.11 244 / 0.52)",
    label: "characters",
  },
  faction: {
    dotColor: "oklch(0.82 0.11 72 / 0.95)",
    edgeTint: "oklch(0.82 0.11 72 / 0.52)",
    label: "factions",
  },
  location: {
    dotColor: "oklch(0.83 0.1 155 / 0.95)",
    edgeTint: "oklch(0.83 0.1 155 / 0.52)",
    label: "locations",
  },
  note: {
    dotColor: "oklch(0.79 0.1 299 / 0.95)",
    edgeTint: "oklch(0.79 0.1 299 / 0.52)",
    label: "notes",
  },
};

export function getEntityTypeStyle(entityType: string | null): EntityTypeStyle {
  if (!entityType) return UNKNOWN_STYLE;
  return MAP[entityType] ?? { ...UNKNOWN_STYLE, label: entityType };
}
