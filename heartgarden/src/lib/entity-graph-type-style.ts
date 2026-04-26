export type EntityTypeStyle = {
  dotColor: string;
  edgeTint: string;
  label: string;
};

const UNKNOWN_STYLE: EntityTypeStyle = {
  dotColor: "oklch(0.62 0.06 255 / 0.82)",
  edgeTint: "oklch(0.62 0.06 255 / 0.56)",
  label: "unknown",
};

const MAP: Record<string, EntityTypeStyle> = {
  character: {
    dotColor: "oklch(0.72 0.26 250)",
    edgeTint: "oklch(0.72 0.26 250 / 0.52)",
    label: "characters",
  },
  faction: {
    dotColor: "oklch(0.74 0.31 50)",
    edgeTint: "oklch(0.74 0.31 50 / 0.52)",
    label: "factions",
  },
  location: {
    dotColor: "oklch(0.74 0.24 155)",
    edgeTint: "oklch(0.74 0.24 155 / 0.52)",
    label: "locations",
  },
  note: {
    dotColor: "oklch(0.72 0.26 300)",
    edgeTint: "oklch(0.72 0.26 300 / 0.52)",
    label: "notes",
  },
};

export function getEntityTypeStyle(entityType: string | null): EntityTypeStyle {
  if (!entityType) return UNKNOWN_STYLE;
  return MAP[entityType] ?? { ...UNKNOWN_STYLE, label: entityType };
}
