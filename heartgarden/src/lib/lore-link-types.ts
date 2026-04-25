import type {
  CanvasEntity,
  LoreCardKind,
} from "@/src/components/foundation/architectural-types";
import { normalizeLinkTypeAlias } from "@/src/lib/connection-kind-colors";

/** `item_links.link_type` grouping for UI (default pin vs canonical relationships). */
export type LinkTypeGroup = "canvas" | "relationship";

export const LINK_TYPE_GROUP_ORDER: readonly LinkTypeGroup[] = [
  "canvas",
  "relationship",
] as const;

/** Section titles in connection context menus (threads vs prose mentions). */
export const LINK_TYPE_GROUP_HEADINGS: Record<LinkTypeGroup, string> = {
  canvas: "Canvas (default)",
  relationship: "Relationships",
};

export interface LoreLinkTypeOption {
  group: LinkTypeGroup;
  /** Short label (datalist, compact UIs). */
  label: string;
  /** Primary label for menus and pickers. */
  menuLabel: string;
  value: string;
}

/**
 * Values stored in `item_links.link_type` for the canonical canvas relationship
 * vocabulary. Keep lean and semantically distinct so retrieval / generation can
 * reason over them reliably.
 */
export const LORE_LINK_TYPE_OPTIONS: readonly LoreLinkTypeOption[] = [
  {
    group: "canvas",
    label: "Pin thread",
    menuLabel: "Pin thread (default rope)",
    value: "pin",
  },
  { group: "relationship", label: "Bond", menuLabel: "Bond", value: "bond" },
  {
    group: "relationship",
    label: "Affiliation",
    menuLabel: "Affiliation",
    value: "affiliation",
  },
  {
    group: "relationship",
    label: "Contract",
    menuLabel: "Contract",
    value: "contract",
  },
  {
    group: "relationship",
    label: "Conflict",
    menuLabel: "Conflict",
    value: "conflict",
  },
  {
    group: "relationship",
    label: "History",
    menuLabel: "History",
    value: "history",
  },
] as const;

export type LoreLinkTypeValue =
  (typeof LORE_LINK_TYPE_OPTIONS)[number]["value"];

const OPTION_BY_VALUE: Record<string, LoreLinkTypeOption | undefined> =
  Object.fromEntries(LORE_LINK_TYPE_OPTIONS.map((o) => [o.value, o]));

/** Label for menus; falls back to raw value for unknown / forward-compatible types. */
export function menuLabelForLinkType(value: string | null | undefined): string {
  if (!value) {
    return "Pin thread";
  }
  const o = OPTION_BY_VALUE[normalizeLinkTypeAlias(value)];
  return o?.menuLabel ?? value;
}

function loreCardKindFromEntity(
  entity: CanvasEntity | undefined
): LoreCardKind | null {
  if (!entity || entity.kind !== "content") {
    return null;
  }
  return entity.loreCard?.kind ?? null;
}

/**
 * Higher score = show earlier within the same group when tagging a thread between two endpoints.
 */
function linkTypeRankScore(
  value: string,
  source: CanvasEntity | undefined,
  target: CanvasEntity | undefined
): number {
  const ks = loreCardKindFromEntity(source);
  const kt = loreCardKindFromEntity(target);
  let s = 0;

  if (value === "pin") {
    s += 8;
  }
  if (value === "bond" && ks === "character" && kt === "character") {
    s += 20;
  }
  if (
    value === "affiliation" &&
    ((ks === "character" && kt === "faction") ||
      (kt === "character" && ks === "faction"))
  ) {
    s += 22;
  }
  if (
    value === "contract" &&
    ((ks === "character" && kt === "faction") ||
      (kt === "character" && ks === "faction"))
  ) {
    s += 16;
  }
  if (value === "conflict") {
    s += 10;
  }
  if (
    value === "history" &&
    ((ks === "character" && kt === "location") ||
      (kt === "character" && ks === "location"))
  ) {
    s += 14;
  }

  return s;
}

/** All options in group order; within each group, ranked for the given thread endpoints. */
export function orderedLoreLinkTypeOptionsForEndpoints(
  source: CanvasEntity | undefined,
  target: CanvasEntity | undefined
): LoreLinkTypeOption[] {
  const byGroup: Record<LinkTypeGroup, LoreLinkTypeOption[]> = {
    canvas: [],
    relationship: [],
  };
  for (const o of LORE_LINK_TYPE_OPTIONS) {
    byGroup[o.group].push(o);
  }
  for (const g of LINK_TYPE_GROUP_ORDER) {
    byGroup[g].sort(
      (a, b) =>
        linkTypeRankScore(b.value, source, target) -
        linkTypeRankScore(a.value, source, target)
    );
  }
  return LINK_TYPE_GROUP_ORDER.flatMap((g) => byGroup[g]);
}

/**
 * Options grouped for context menus (headings + rows). Order matches `LINK_TYPE_GROUP_ORDER`.
 */
export function groupedOrderedLinkOptionsForEndpoints(
  source: CanvasEntity | undefined,
  target: CanvasEntity | undefined
): { group: LinkTypeGroup; options: LoreLinkTypeOption[] }[] {
  const ordered = orderedLoreLinkTypeOptionsForEndpoints(source, target);
  return LINK_TYPE_GROUP_ORDER.map((g) => ({
    group: g,
    options: ordered.filter((o) => o.group === g),
  })).filter((x) => x.options.length > 0);
}
