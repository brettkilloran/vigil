/**
 * Canonical binding vs association vocabulary for lore shells.
 * Human-readable spec: docs/BINDINGS_CATALOG.md
 */

/** All persisted `item_links` (and mirrored bindings) stay within one `items.space_id` — see `validateLinkTargetsInSourceSpace`. */
export const CROSS_SPACE_LINK_POLICY =
  "same_space_only" as const;

/**
 * Version for structured `content_json.hgArch` binding payloads.
 * Bump when slot shapes migrate; readers should tolerate unknown keys.
 */
export const HGARCH_BINDINGS_SCHEMA_VERSION = 1 as const;

export type LoreBindingShell = "character" | "faction" | "location" | "generic_note";

/** Structured field on the card (`content_json.hgArch` / entity shape) — source of truth for display slots. */
export type BindingSlotId =
  | "character.primaryLocations"
  | "character.primaryFactions"
  | "character.loreThreadAnchors"
  | "faction.factionRoster"
  | "faction.parentNation"
  | "faction.hqLocation"
  | "location.linkedCharacters"
  | "location.parentRegion";

/** Canvas connection (`item_links`) semantic bucket for recall / MCP copy — not a second source of truth for card slots. */
export type CanvasConnectionKind = "pin" | "relationship" | "story_tag" | "other";

export type BindingSlotDefinition = {
  id: BindingSlotId;
  shell: LoreBindingShell;
  label: string;
  cardinality: "0-1" | "0-n";
  /** `items.entity_type` values allowed as targets when slot stores item ids. */
  targetEntityTypes: string[];
  /** Whether a successful bind typically also creates a mirrored `item_links` row for the rope. */
  mirrorCanvasConnection: boolean;
  /** User actions that write this slot (see catalog doc for reconciliation). */
  writtenBy: string[];
};

export const BINDING_SLOT_DEFINITIONS: readonly BindingSlotDefinition[] = [
  {
    id: "faction.factionRoster",
    shell: "faction",
    label: "Member roster",
    cardinality: "0-n",
    targetEntityTypes: ["character"],
    mirrorCanvasConnection: true,
    writtenBy: ["draw thread to roster row", "import apply", "structured field edit", "MCP patch item"],
  },
  {
    id: "character.loreThreadAnchors",
    shell: "character",
    label: "Thread anchors (location / faction hints)",
    cardinality: "0-n",
    targetEntityTypes: ["location", "faction"],
    mirrorCanvasConnection: true,
    writtenBy: ["draw thread (char↔loc)", "import", "MCP patch item"],
  },
  {
    id: "location.linkedCharacters",
    shell: "location",
    label: "Linked characters (mirror of character primary location when threaded)",
    cardinality: "0-n",
    targetEntityTypes: ["character"],
    mirrorCanvasConnection: true,
    writtenBy: ["draw thread (char↔loc)", "MCP patch item"],
  },
  {
    id: "character.primaryFactions",
    shell: "character",
    label: "Employer / faction lines (card chrome + focus affiliation — reconcile with roster)",
    cardinality: "0-n",
    targetEntityTypes: ["faction"],
    mirrorCanvasConnection: false,
    writtenBy: ["card field edit", "projection from connection", "import"],
  },
  {
    id: "character.primaryLocations",
    shell: "character",
    label: "Home / primary locations",
    cardinality: "0-n",
    targetEntityTypes: ["location"],
    mirrorCanvasConnection: false,
    writtenBy: ["card field edit", "projection from connection", "import"],
  },
  {
    id: "faction.parentNation",
    shell: "faction",
    label: "Parent nation / umbrella (planned)",
    cardinality: "0-1",
    targetEntityTypes: ["faction", "lore"],
    mirrorCanvasConnection: false,
    writtenBy: ["future: bind UI"],
  },
  {
    id: "faction.hqLocation",
    shell: "faction",
    label: "HQ location (planned)",
    cardinality: "0-1",
    targetEntityTypes: ["location"],
    mirrorCanvasConnection: false,
    writtenBy: ["future: bind UI"],
  },
  {
    id: "location.parentRegion",
    shell: "location",
    label: "Parent region (planned)",
    cardinality: "0-1",
    targetEntityTypes: ["location"],
    mirrorCanvasConnection: false,
    writtenBy: ["future: bind UI"],
  },
];

/** Optional `item_links.meta.linkSemantics` / `linkRole` values (string stored in JSON). */
export const LINK_SEMANTICS = {
  /** Ordinary canvas / import / MCP graph edge. */
  association: "association",
  /** Edge that mirrors a structured hgArch slot (same pair may also appear as binding data). */
  structuredMirror: "structured_mirror",
} as const;

export type LinkSemanticsValue = (typeof LINK_SEMANTICS)[keyof typeof LINK_SEMANTICS];
