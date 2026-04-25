/**
 * Canonical binding vs association vocabulary for lore shells.
 * Human-readable spec: docs/BINDINGS_CATALOG.md
 */

/** All persisted `item_links` (and mirrored bindings) stay within one brane — see `validateLinkTargetsInBrane`. */
export const CROSS_SPACE_LINK_POLICY = "same_brane_only" as const;

/**
 * Version for structured `content_json.hgArch` binding payloads.
 * Bump when slot shapes migrate; readers should tolerate unknown keys.
 */
export const HGARCH_BINDINGS_SCHEMA_VERSION = 1 as const;

export type LoreBindingShell =
  | "character"
  | "faction"
  | "location"
  | "generic_note";

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
export type CanvasConnectionKind = "pin" | "relationship";

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
    writtenBy: [
      "draw thread to roster row",
      "import apply",
      "structured field edit",
      "MCP patch item",
    ],
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
    label:
      "Linked characters (mirror of character primary location when threaded)",
    cardinality: "0-n",
    targetEntityTypes: ["character"],
    mirrorCanvasConnection: true,
    writtenBy: ["draw thread (char↔loc)", "MCP patch item"],
  },
  {
    id: "character.primaryFactions",
    shell: "character",
    label:
      "Employer / faction lines (card chrome + focus affiliation — reconcile with roster)",
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

export const BINDING_SLOT_BY_ID = Object.fromEntries(
  BINDING_SLOT_DEFINITIONS.map((d) => [d.id, d])
) as Record<BindingSlotId, BindingSlotDefinition>;

/** Optional `item_links.meta.linkSemantics` / `linkRole` values (string stored in JSON). */
export const LINK_SEMANTICS = {
  /** Ordinary canvas / import / MCP graph edge. */
  association: "association",
  /** Edge that mirrors a structured hgArch slot (same pair may also appear as binding data). */
  structuredMirror: "structured_mirror",
} as const;

export type LinkSemanticsValue =
  (typeof LINK_SEMANTICS)[keyof typeof LINK_SEMANTICS];

// --- Canvas thread draw → hgArch (semantic eval) --------------------------------

/** Lore shells that participate in draw-to-bind today (generic notes → association-only). */
export type ThreadDrawShell = Extract<
  LoreBindingShell,
  "character" | "faction" | "location"
>;

/**
 * Ordered, stable effect ids implemented in `canvas-thread-link-eval.ts`.
 * Adding a slot here = add handler + rule row; keep `touchesSlots` in sync with real patches.
 */
export type CanvasThreadSemanticEffect =
  | "faction_roster_row_bind"
  | "character_faction_thread_anchor"
  | "character_location_bidirectional";

export type CanvasThreadSemanticPhase = "roster_target" | "default";

export type CanvasThreadSemanticRule = {
  id: string;
  phase: CanvasThreadSemanticPhase;
  /** Lower runs first within the same phase. */
  priority: number;
  /**
   * Sorted pair of endpoint shells (order-independent match).
   * Both nodes must be `content` entities with this `loreCard.kind`.
   */
  endpointShells: readonly [ThreadDrawShell, ThreadDrawShell];
  /** hgArch slots this rule mutates when it applies — traceability to `BINDING_SLOT_DEFINITIONS`. */
  touchesSlots: readonly BindingSlotId[];
  effect: CanvasThreadSemanticEffect;
};

/**
 * Rules for `runSemanticThreadLinkEvaluation`.
 *
 * - **roster_target** phase runs only when `rosterEntryId != null` (click completed on a roster row).
 *   If no rule matches, evaluation stops with `{ kind: "none" }` (do not fall through to location, etc.).
 * - **default** phase runs only when `rosterEntryId == null`.
 */
/** Declarative order: roster-target phase first within its group; then default phase by priority. */
export const CANVAS_THREAD_SEMANTIC_RULES: readonly CanvasThreadSemanticRule[] =
  [
    {
      id: "faction_roster_row",
      phase: "roster_target",
      priority: 10,
      endpointShells: ["character", "faction"],
      touchesSlots: ["faction.factionRoster", "character.loreThreadAnchors"],
      effect: "faction_roster_row_bind",
    },
    {
      id: "character_faction_card_face",
      phase: "default",
      priority: 10,
      endpointShells: ["character", "faction"],
      touchesSlots: ["character.loreThreadAnchors"],
      effect: "character_faction_thread_anchor",
    },
    {
      id: "character_location_mirror",
      phase: "default",
      priority: 20,
      endpointShells: ["character", "location"],
      touchesSlots: [
        "character.loreThreadAnchors",
        "location.linkedCharacters",
      ],
      effect: "character_location_bidirectional",
    },
  ];

export function sortedThreadDrawShellPair(
  a: ThreadDrawShell,
  b: ThreadDrawShell
): readonly [ThreadDrawShell, ThreadDrawShell] {
  return a <= b ? [a, b] : [b, a];
}
