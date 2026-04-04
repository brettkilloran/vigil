/** Values stored in `item_links.link_type` for TTRPG / canvas semantics. */
export const LORE_LINK_TYPE_OPTIONS = [
  { value: "pin", label: "Pin thread" },
  { value: "reference", label: "Reference" },
  { value: "ally", label: "Ally" },
  { value: "enemy", label: "Enemy" },
  { value: "neutral", label: "Neutral" },
  { value: "faction", label: "Faction" },
  { value: "quest", label: "Quest" },
  { value: "location", label: "Location" },
  { value: "npc", label: "NPC" },
  { value: "lore", label: "Lore" },
] as const;

export type LoreLinkTypeValue = (typeof LORE_LINK_TYPE_OPTIONS)[number]["value"];
