/**
 * Canonical mapping between canvas **connection kinds** (`item_links.link_type`)
 * and their visual color (a `FolderColorSchemeId` + raw swatch string).
 *
 * Single source of truth for the thread color picker, the thread right-click
 * "Tag" menu, and the lock-together invariant: **color and linkType move
 * together**. Picking a kind sets both; recoloring a thread re-tags it;
 * re-tagging a thread re-colors it.
 *
 * Not every `lore-link-types.ts` option is a picker kind — legacy import-era
 * tags (`faction`, `location`, `npc`) are preserved on existing data but snap
 * to `other` for coloring.
 */
import {
  FOLDER_COLOR_SCHEMES,
  type FolderColorSchemeId,
  type FolderColorSchemeMeta,
} from "@/src/components/foundation/architectural-folder-schemes";

/** Kinds surfaced in the connection picker. Order matches the picker UI. */
export const CONNECTION_KINDS_IN_ORDER = [
  "pin",
  "reference",
  "ally",
  "enemy",
  "neutral",
  "quest",
  "lore",
  "other",
] as const;

export type ConnectionKind = (typeof CONNECTION_KINDS_IN_ORDER)[number];

export type ConnectionKindMeta = {
  kind: ConnectionKind;
  /** `item_links.link_type` value written to the data layer. */
  linkType: string;
  /** Label shown next to the swatch in the picker. */
  label: string;
  /** One-line caption for tooltips / aria. */
  hint: string;
  /** Folder color scheme id (shared with folder tints for visual continuity). */
  scheme: FolderColorSchemeId;
  /** Resolved OKLCH swatch string used as `CanvasPinConnection.color`. */
  swatch: string;
  /** Lighter / neon rim color for selected states and ring accents. */
  border: string;
};

function schemeMeta(id: FolderColorSchemeId): FolderColorSchemeMeta {
  const found = FOLDER_COLOR_SCHEMES.find((s) => s.id === id);
  if (!found) {
    throw new Error(`connection-kind-colors: missing folder scheme '${id}'`);
  }
  return found;
}

/**
 * Canonical kind -> color mapping. Labels lean on `lore-link-types.ts`
 * vocabulary; swatches reuse folder schemes so threads and folder faces share
 * a palette.
 *
 * - `pin` = coral: the app's default warm orange (current
 *   `CONNECTION_DEFAULT_COLOR`) — untyped rope between two cards.
 * - `reference` = cyan (Aqua): "comms, data flow, blueprints".
 * - `ally` = rose: "care, intimacy, gentle obligations".
 * - `enemy` = wine: deep red, adversarial heft.
 * - `neutral` = gray: low-emphasis tie, background link.
 * - `quest` = ocean (Cobalt): "main spine — travel, trade, big plot".
 * - `lore` = parchment (Peach): "history, lore, older story roads".
 * - `other` = violet: arcane / custom / describe in link label.
 */
const CONNECTION_KIND_TABLE: Record<ConnectionKind, ConnectionKindMeta> = (() => {
  const rows: Array<Omit<ConnectionKindMeta, "swatch" | "border"> & { scheme: FolderColorSchemeId }> = [
    {
      kind: "pin",
      linkType: "pin",
      label: "Pin",
      hint: "Default rope — untyped link between two cards.",
      scheme: "coral",
    },
    {
      kind: "reference",
      linkType: "reference",
      label: "Reference",
      hint: "Comms, data flow, info lookups.",
      scheme: "cyan",
    },
    {
      kind: "ally",
      linkType: "ally",
      label: "Ally",
      hint: "Care, intimacy, gentle obligations.",
      scheme: "rose",
    },
    {
      kind: "enemy",
      linkType: "enemy",
      label: "Enemy",
      hint: "Conflict, rivalry, grudges.",
      scheme: "wine",
    },
    {
      kind: "neutral",
      linkType: "neutral",
      label: "Neutral",
      hint: "Background ties, low-emphasis links.",
      scheme: "gray",
    },
    {
      kind: "quest",
      linkType: "quest",
      label: "Quest",
      hint: "Main spine — travel, trade, big plot.",
      scheme: "ocean",
    },
    {
      kind: "lore",
      linkType: "lore",
      label: "Lore",
      hint: "History, myths, older story roads.",
      scheme: "parchment",
    },
    {
      kind: "other",
      linkType: "other",
      label: "Other",
      hint: "Arcane, experimental, or custom — describe in link label.",
      scheme: "violet",
    },
  ];
  return Object.fromEntries(
    rows.map((r) => {
      const meta = schemeMeta(r.scheme);
      const full: ConnectionKindMeta = {
        ...r,
        swatch: meta.swatch,
        border: meta.border,
      };
      return [r.kind, full];
    }),
  ) as Record<ConnectionKind, ConnectionKindMeta>;
})();

export const CONNECTION_KINDS: readonly ConnectionKindMeta[] =
  CONNECTION_KINDS_IN_ORDER.map((k) => CONNECTION_KIND_TABLE[k]);

export function connectionKindMeta(kind: ConnectionKind): ConnectionKindMeta {
  return CONNECTION_KIND_TABLE[kind];
}

export function colorForConnectionKind(kind: ConnectionKind): string {
  return CONNECTION_KIND_TABLE[kind].swatch;
}

export function linkTypeForConnectionKind(kind: ConnectionKind): string {
  return CONNECTION_KIND_TABLE[kind].linkType;
}

export function schemeIdForConnectionKind(kind: ConnectionKind): FolderColorSchemeId {
  return CONNECTION_KIND_TABLE[kind].scheme;
}

/** Direct `link_type` (string) -> `ConnectionKind` (picker kind), or null if legacy / unknown. */
export function connectionKindFromLinkType(linkType: string | null | undefined): ConnectionKind | null {
  if (!linkType) return null;
  const match = CONNECTION_KINDS.find((m) => m.linkType === linkType);
  return match ? match.kind : null;
}

function parseOklch(swatch: string): { L: number; C: number; H: number } | null {
  const m = swatch.trim().match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([-.\d]+)/i);
  if (!m) return null;
  return { L: Number(m[1]), C: Number(m[2]), H: Number(m[3]) };
}

function oklchDistance(
  a: { L: number; C: number; H: number },
  b: { L: number; C: number; H: number },
): number {
  const dL = a.L - b.L;
  const dC = a.C - b.C;
  let dH = Math.abs(a.H - b.H);
  if (dH > 180) dH = 360 - dH;
  const hueWeight = Math.max(a.C, b.C);
  const dh = (dH / 180) * hueWeight;
  return Math.sqrt(dL * dL + dC * dC + dh * dh);
}

/**
 * Snap an arbitrary OKLCH color to the closest `ConnectionKind`. Used both
 * for legacy thread migration and to resolve the picker's current selection
 * when a connection has a color that doesn't exactly match a canonical swatch.
 */
export function snapColorToConnectionKind(color: string | null | undefined): ConnectionKind {
  if (!color) return "pin";
  const exact = CONNECTION_KINDS.find((m) => m.swatch === color);
  if (exact) return exact.kind;
  const parsed = parseOklch(color);
  if (!parsed) return "pin";
  let best: ConnectionKind = "pin";
  let bestDist = Infinity;
  for (const meta of CONNECTION_KINDS) {
    const other = parseOklch(meta.swatch);
    if (!other) continue;
    const d = oklchDistance(parsed, other);
    if (d < bestDist) {
      bestDist = d;
      best = meta.kind;
    }
  }
  return best;
}

/**
 * Canonical kind for a stored connection (color + linkType). Prefer a valid
 * picker `linkType`; otherwise snap by color. Legacy import-era link types
 * (`faction`, `location`, `npc`) fall through to color-snap — color carries
 * meaning in that case, not the legacy story-tag.
 */
export function canonicalKindForConnection(params: {
  color: string | null | undefined;
  linkType: string | null | undefined;
}): ConnectionKind {
  const byLinkType = connectionKindFromLinkType(params.linkType);
  if (byLinkType) return byLinkType;
  return snapColorToConnectionKind(params.color);
}

export type CanonicalConnectionPair = {
  color: string;
  linkType: string;
};

export function canonicalPairForKind(kind: ConnectionKind): CanonicalConnectionPair {
  const meta = CONNECTION_KIND_TABLE[kind];
  return { color: meta.swatch, linkType: meta.linkType };
}

/**
 * True if the stored (color, linkType) is already the canonical pair for some
 * picker kind. Legacy story-tag link types (`faction`, `location`, `npc`) are
 * treated as canonical-as-stored (we don't rewrite them during migration).
 */
export function isCanonicalConnectionPair(params: {
  color: string | null | undefined;
  linkType: string | null | undefined;
}): boolean {
  const byLinkType = connectionKindFromLinkType(params.linkType);
  if (byLinkType) {
    return params.color === CONNECTION_KIND_TABLE[byLinkType].swatch;
  }
  const storyTagLegacy = new Set(["faction", "location", "npc"]);
  if (params.linkType && storyTagLegacy.has(params.linkType)) return true;
  return false;
}
