export type RelationStyle = {
  label: string;
  strokeDasharray?: string;
  accent: string;
};

const DEFAULT_RELATION_STYLE: RelationStyle = {
  label: "related_to",
  accent: "rgba(176, 176, 176, 0.7)",
};

const RELATION_STYLES: Record<string, RelationStyle> = {
  member_of: { label: "member_of", accent: "rgba(132, 182, 255, 0.9)" },
  operates_in: { label: "operates_in", accent: "rgba(114, 210, 177, 0.9)" },
  trade_route: { label: "trade_route", accent: "rgba(250, 205, 128, 0.9)", strokeDasharray: "4 2" },
  mentioned_in: { label: "mentioned_in", accent: "rgba(181, 157, 255, 0.9)", strokeDasharray: "3 3" },
  referenced_by: { label: "referenced_by", accent: "rgba(255, 172, 135, 0.9)", strokeDasharray: "2 3" },
  cross_ref: { label: "cross_ref", accent: "rgba(255, 140, 140, 0.9)", strokeDasharray: "5 2" },
  rival_of: { label: "rival_of", accent: "rgba(255, 117, 117, 0.9)", strokeDasharray: "6 3" },
};

export function getRelationStyle(linkType: string | null): RelationStyle {
  if (!linkType) return DEFAULT_RELATION_STYLE;
  return RELATION_STYLES[linkType] ?? { ...DEFAULT_RELATION_STYLE, label: linkType };
}
