import type { CanvasEntity, LoreCardKind } from "@/src/components/foundation/architectural-types";

/** `item_links.link_type` grouping for UI (canvas default vs relationships vs import-era role tags). */
export type LinkTypeGroup = "canvas" | "relationship" | "story_tag";

export const LINK_TYPE_GROUP_ORDER: readonly LinkTypeGroup[] = [
  "canvas",
  "relationship",
  "story_tag",
] as const;

/** Section titles in connection context menus (threads vs prose mentions). */
export const LINK_TYPE_GROUP_HEADINGS: Record<LinkTypeGroup, string> = {
  canvas: "Canvas (default)",
  relationship: "Relationships",
  story_tag: "Story roles (import · legacy)",
};

export type LoreLinkTypeOption = {
  value: string;
  /** Short label (datalist, compact UIs). */
  label: string;
  group: LinkTypeGroup;
  /** Primary label for menus and pickers. */
  menuLabel: string;
};

/**
 * Values stored in `item_links.link_type` for TTRPG / canvas semantics.
 * `menuLabel` avoids clashing with lore **entity** kinds (organization cards use `faction` in DB).
 */
export const LORE_LINK_TYPE_OPTIONS: readonly LoreLinkTypeOption[] = [
  { value: "pin", label: "Pin thread", group: "canvas", menuLabel: "Pin thread (default rope)" },
  { value: "reference", label: "Reference", group: "relationship", menuLabel: "Reference" },
  { value: "ally", label: "Ally", group: "relationship", menuLabel: "Ally" },
  { value: "enemy", label: "Enemy", group: "relationship", menuLabel: "Enemy" },
  { value: "neutral", label: "Neutral", group: "relationship", menuLabel: "Neutral" },
  { value: "quest", label: "Quest", group: "relationship", menuLabel: "Quest" },
  { value: "lore", label: "Lore", group: "relationship", menuLabel: "Lore" },
  {
    value: "other",
    label: "Other",
    group: "relationship",
    menuLabel: "Other (describe in link label / notes)",
  },
  {
    value: "faction",
    label: "Faction",
    group: "story_tag",
    menuLabel: "Organization tie (stored as faction)",
  },
  {
    value: "location",
    label: "Location",
    group: "story_tag",
    menuLabel: "Location tie (stored as location)",
  },
  {
    value: "npc",
    label: "NPC",
    group: "story_tag",
    menuLabel: "Character tie (stored as npc)",
  },
] as const;

export type LoreLinkTypeValue = (typeof LORE_LINK_TYPE_OPTIONS)[number]["value"];

const OPTION_BY_VALUE: Record<string, LoreLinkTypeOption | undefined> = Object.fromEntries(
  LORE_LINK_TYPE_OPTIONS.map((o) => [o.value, o]),
);

/** Label for menus; falls back to raw value for unknown / forward-compatible types. */
export function menuLabelForLinkType(value: string | null | undefined): string {
  if (!value) return "Pin thread";
  const o = OPTION_BY_VALUE[value];
  return o?.menuLabel ?? value;
}

function loreCardKindFromEntity(entity: CanvasEntity | undefined): LoreCardKind | null {
  if (!entity || entity.kind !== "content") return null;
  return entity.loreCard?.kind ?? null;
}

/**
 * Higher score = show earlier within the same group when tagging a thread between two endpoints.
 */
function linkTypeRankScore(
  value: string,
  source: CanvasEntity | undefined,
  target: CanvasEntity | undefined,
): number {
  const ks = loreCardKindFromEntity(source);
  const kt = loreCardKindFromEntity(target);
  let s = 0;

  if (value === "pin") s += 8;

  if (["ally", "enemy", "neutral"].includes(value) && ks === "character" && kt === "character") {
    s += 28;
  }
  if (
    (value === "faction" || value === "ally") &&
    ((ks === "character" && kt === "faction") || (kt === "character" && ks === "faction"))
  ) {
    s += 22;
  }
  if (
    (value === "location" || value === "lore") &&
    ((ks === "character" && kt === "location") || (kt === "character" && ks === "location"))
  ) {
    s += 16;
  }
  if (value === "quest" && (ks === "character" || kt === "character")) s += 6;
  if (value === "other") s += 2;

  // Deprioritize role tags that duplicate both endpoints' entity kinds (still available).
  if (value === "location" && ks === "location" && kt === "location") s -= 24;
  if (value === "faction" && ks === "faction" && kt === "faction") s -= 24;
  if (value === "npc" && ks === "character" && kt === "character") s -= 8;

  return s;
}

/** All options in group order; within each group, ranked for the given thread endpoints. */
export function orderedLoreLinkTypeOptionsForEndpoints(
  source: CanvasEntity | undefined,
  target: CanvasEntity | undefined,
): LoreLinkTypeOption[] {
  const byGroup: Record<LinkTypeGroup, LoreLinkTypeOption[]> = {
    canvas: [],
    relationship: [],
    story_tag: [],
  };
  for (const o of LORE_LINK_TYPE_OPTIONS) {
    byGroup[o.group].push(o);
  }
  for (const g of LINK_TYPE_GROUP_ORDER) {
    byGroup[g].sort(
      (a, b) =>
        linkTypeRankScore(b.value, source, target) - linkTypeRankScore(a.value, source, target),
    );
  }
  return LINK_TYPE_GROUP_ORDER.flatMap((g) => byGroup[g]);
}

/**
 * Options grouped for context menus (headings + rows). Order matches `LINK_TYPE_GROUP_ORDER`.
 */
export function groupedOrderedLinkOptionsForEndpoints(
  source: CanvasEntity | undefined,
  target: CanvasEntity | undefined,
): { group: LinkTypeGroup; options: LoreLinkTypeOption[] }[] {
  const ordered = orderedLoreLinkTypeOptionsForEndpoints(source, target);
  return LINK_TYPE_GROUP_ORDER.map((g) => ({
    group: g,
    options: ordered.filter((o) => o.group === g),
  })).filter((x) => x.options.length > 0);
}
