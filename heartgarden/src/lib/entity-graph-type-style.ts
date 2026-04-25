export type EntityTypeStyle = {
  dotColor: string;
  edgeTint: string;
  label: string;
};

const UNKNOWN_STYLE: EntityTypeStyle = {
  dotColor: "rgba(200, 200, 200, 0.82)",
  edgeTint: "rgba(200, 200, 200, 0.56)",
  label: "unknown",
};

const MAP: Record<string, EntityTypeStyle> = {
  character: {
    dotColor: "rgba(123, 196, 255, 0.95)",
    edgeTint: "rgba(123, 196, 255, 0.52)",
    label: "characters",
  },
  faction: {
    dotColor: "rgba(255, 185, 116, 0.95)",
    edgeTint: "rgba(255, 185, 116, 0.52)",
    label: "factions",
  },
  location: {
    dotColor: "rgba(125, 224, 171, 0.95)",
    edgeTint: "rgba(125, 224, 171, 0.52)",
    label: "locations",
  },
  note: {
    dotColor: "rgba(182, 156, 255, 0.95)",
    edgeTint: "rgba(182, 156, 255, 0.52)",
    label: "notes",
  },
};

export function getEntityTypeStyle(entityType: string | null): EntityTypeStyle {
  if (!entityType) return UNKNOWN_STYLE;
  return MAP[entityType] ?? { ...UNKNOWN_STYLE, label: entityType };
}
