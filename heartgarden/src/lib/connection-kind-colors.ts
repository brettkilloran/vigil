/**
 * Canonical mapping between canvas **connection kinds** (`item_links.link_type`)
 * and their visual color (a `FolderColorSchemeId` + raw swatch string).
 *
 * Single source of truth for the thread color picker, the thread right-click
 * "Tag" menu, and the lock-together invariant: **color and linkType move
 * together**. Picking a kind sets both; recoloring a thread re-tags it;
 * re-tagging a thread re-colors it.
 *
 * Legacy labels are normalized through aliases so existing data snaps forward
 * into the current canonical set.
 */
import {
  FOLDER_COLOR_SCHEMES,
  type FolderColorSchemeId,
  type FolderColorSchemeMeta,
} from "@/src/components/foundation/architectural-folder-schemes";

/** Kinds surfaced in the connection picker. Order matches the picker UI. */
export const CONNECTION_KINDS_IN_ORDER = [
  "pin",
  "bond",
  "affiliation",
  "contract",
  "conflict",
  "history",
] as const;

export type ConnectionKind = (typeof CONNECTION_KINDS_IN_ORDER)[number];

export interface ConnectionKindMeta {
  /**
   * Tokens for AI retrieval/generation hints. Keep terse and domain-agnostic;
   * prompts can expand these into richer prose guidance.
   */
  autopopulationKeywords: readonly string[];
  /** Lighter / neon rim color for selected states and ring accents. */
  border: string;
  /** One-line caption for tooltips / aria. */
  hint: string;
  kind: ConnectionKind;
  /** Label shown next to the swatch in the picker. */
  label: string;
  /** `item_links.link_type` value written to the data layer. */
  linkType: string;
  /** Folder color scheme id (shared with folder tints for visual continuity). */
  scheme: FolderColorSchemeId;
  /** Stable semantic family for ranking, prompts, and future field hints. */
  semanticFamily:
    | "default"
    | "social"
    | "institutional"
    | "operational"
    | "adversarial"
    | "historical";
  /** Resolved OKLCH swatch string used as `CanvasPinConnection.color`. */
  swatch: string;
}

function schemeMeta(id: FolderColorSchemeId): FolderColorSchemeMeta {
  const found = FOLDER_COLOR_SCHEMES.find((s) => s.id === id);
  if (!found) {
    throw new Error(`connection-kind-colors: missing folder scheme '${id}'`);
  }
  return found;
}

/**
 * Canonical kind -> color mapping. Swatches reuse folder schemes so threads
 * and folder faces share a palette.
 *
 * NV-aligned six-type core:
 * - `pin`         coral     default rope / unspecified tie
 * - `bond`        rose      trusted personal tie
 * - `affiliation` ocean     membership or alignment with an org/bloc
 * - `contract`    gray      formal work, mission, debt duty
 * - `conflict`    wine      opposition, pressure, coercion
 * - `history`     parchment former ties and shared past
 */
const CONNECTION_KIND_TABLE: Record<ConnectionKind, ConnectionKindMeta> =
  (() => {
    const rows: Array<
      Omit<ConnectionKindMeta, "swatch" | "border"> & {
        scheme: FolderColorSchemeId;
      }
    > = [
      {
        autopopulationKeywords: ["default", "unspecified", "generic"],
        hint: "Default rope — untyped link between two cards.",
        kind: "pin",
        label: "Pin",
        linkType: "pin",
        scheme: "coral",
        semanticFamily: "default",
      },
      {
        autopopulationKeywords: ["trust", "loyalty", "coven", "intimacy"],
        hint: "Trusted personal tie — coven, partner, or sworn ally.",
        kind: "bond",
        label: "Bond",
        linkType: "bond",
        scheme: "rose",
        semanticFamily: "social",
      },
      {
        autopopulationKeywords: [
          "membership",
          "alignment",
          "faction",
          "organization",
        ],
        hint: "Belongs to or aligns with an organization, bloc, or nation.",
        kind: "affiliation",
        label: "Affiliation",
        linkType: "affiliation",
        scheme: "ocean",
        semanticFamily: "institutional",
      },
      {
        autopopulationKeywords: ["job", "mission", "employment", "obligation"],
        hint: "Formal mission, paid work, or binding duty.",
        kind: "contract",
        label: "Contract",
        linkType: "contract",
        scheme: "gray",
        semanticFamily: "operational",
      },
      {
        autopopulationKeywords: [
          "rivalry",
          "hostility",
          "war",
          "coercion",
          "debt",
        ],
        hint: "Opposition, hostile pressure, hunt, or coercion.",
        kind: "conflict",
        label: "Conflict",
        linkType: "conflict",
        scheme: "wine",
        semanticFamily: "adversarial",
      },
      {
        autopopulationKeywords: ["former", "origin", "backstory", "legacy"],
        hint: "Former ties, origins, and past events still shaping the present.",
        kind: "history",
        label: "History",
        linkType: "history",
        scheme: "parchment",
        semanticFamily: "historical",
      },
    ];
    return Object.fromEntries(
      rows.map((r) => {
        const meta = schemeMeta(r.scheme);
        const full: ConnectionKindMeta = {
          ...r,
          border: meta.border,
          swatch: meta.swatch,
        };
        return [r.kind, full];
      })
    ) as Record<ConnectionKind, ConnectionKindMeta>;
  })();

export const CONNECTION_KINDS: readonly ConnectionKindMeta[] =
  CONNECTION_KINDS_IN_ORDER.map((k) => CONNECTION_KIND_TABLE[k]);

export const CANONICAL_RELATIONSHIP_LINK_TYPES: readonly string[] =
  CONNECTION_KINDS.filter((k) => k.linkType !== "pin").map((k) => k.linkType);

export function connectionKindMeta(kind: ConnectionKind): ConnectionKindMeta {
  return CONNECTION_KIND_TABLE[kind];
}

export function connectionKindMetaForLinkType(
  linkType: string | null | undefined
): ConnectionKindMeta | null {
  const kind = connectionKindFromLinkType(linkType);
  if (!kind) {
    return null;
  }
  return CONNECTION_KIND_TABLE[kind];
}

export function colorForConnectionKind(kind: ConnectionKind): string {
  return CONNECTION_KIND_TABLE[kind].swatch;
}

export function linkTypeForConnectionKind(kind: ConnectionKind): string {
  return CONNECTION_KIND_TABLE[kind].linkType;
}

export function schemeIdForConnectionKind(
  kind: ConnectionKind
): FolderColorSchemeId {
  return CONNECTION_KIND_TABLE[kind].scheme;
}

export function connectionKindsPromptGlossary(): string {
  return CONNECTION_KINDS.filter((k) => k.linkType !== "pin")
    .map(
      (k) =>
        `- ${k.linkType}: ${k.hint} Keywords: ${k.autopopulationKeywords.join(", ")}.`
    )
    .join("\n");
}

/** Direct `link_type` (string) -> `ConnectionKind` (picker kind), or null if legacy / unknown. */
export function connectionKindFromLinkType(
  linkType: string | null | undefined
): ConnectionKind | null {
  if (!linkType) {
    return null;
  }
  const normalized = normalizeLinkTypeAlias(linkType);
  const match = CONNECTION_KINDS.find((m) => m.linkType === normalized);
  return match ? match.kind : null;
}

const LINK_TYPE_ALIASES: Record<string, string> = {
  ally: "bond",
  enemy: "conflict",
  // Import-era role tags.
  faction: "affiliation",
  // Planned-but-removed semantic.
  leverage: "conflict",
  location: "history",
  lore: "history",
  neutral: "pin",
  npc: "bond",
  other: "history",
  quest: "contract",
  // Previous picker vocabulary.
  reference: "history",
};

export function normalizeLinkTypeAlias(
  linkType: string | null | undefined
): string {
  const t = String(linkType ?? "")
    .trim()
    .toLowerCase();
  if (!t) {
    return "pin";
  }
  return LINK_TYPE_ALIASES[t] ?? t;
}

function parseOklch(
  swatch: string
): { L: number; C: number; H: number } | null {
  const m = swatch.trim().match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([-.\d]+)/i);
  if (!m) {
    return null;
  }
  return { C: Number(m[2]), H: Number(m[3]), L: Number(m[1]) };
}

function oklchDistance(
  a: { L: number; C: number; H: number },
  b: { L: number; C: number; H: number }
): number {
  const dL = a.L - b.L;
  const dC = a.C - b.C;
  let dH = Math.abs(a.H - b.H);
  if (dH > 180) {
    dH = 360 - dH;
  }
  const hueWeight = Math.max(a.C, b.C);
  const dh = (dH / 180) * hueWeight;
  return Math.sqrt(dL * dL + dC * dC + dh * dh);
}

/**
 * Snap an arbitrary OKLCH color to the closest `ConnectionKind`. Used both
 * for legacy thread migration and to resolve the picker's current selection
 * when a connection has a color that doesn't exactly match a canonical swatch.
 */
export function snapColorToConnectionKind(
  color: string | null | undefined
): ConnectionKind {
  if (!color) {
    return "pin";
  }
  const exact = CONNECTION_KINDS.find((m) => m.swatch === color);
  if (exact) {
    return exact.kind;
  }
  const parsed = parseOklch(color);
  if (!parsed) {
    return "pin";
  }
  let best: ConnectionKind = "pin";
  let bestDist = Number.POSITIVE_INFINITY;
  for (const meta of CONNECTION_KINDS) {
    const other = parseOklch(meta.swatch);
    if (!other) {
      continue;
    }
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
 * picker `linkType` after alias normalization; otherwise snap by color.
 */
export function canonicalKindForConnection(params: {
  color: string | null | undefined;
  linkType: string | null | undefined;
}): ConnectionKind {
  const byLinkType = connectionKindFromLinkType(params.linkType);
  if (byLinkType) {
    return byLinkType;
  }
  return snapColorToConnectionKind(params.color);
}

export interface CanonicalConnectionPair {
  color: string;
  linkType: string;
}

export function canonicalPairForKind(
  kind: ConnectionKind
): CanonicalConnectionPair {
  const meta = CONNECTION_KIND_TABLE[kind];
  return { color: meta.swatch, linkType: meta.linkType };
}

/**
 * True if the stored (color, linkType) is already the canonical pair for some
 * picker kind using the canonical raw linkType string (not just an alias).
 * Legacy values intentionally return false so migration rewrites them.
 */
export function isCanonicalConnectionPair(params: {
  color: string | null | undefined;
  linkType: string | null | undefined;
}): boolean {
  const byLinkType = connectionKindFromLinkType(params.linkType);
  if (byLinkType) {
    const raw = String(params.linkType ?? "")
      .trim()
      .toLowerCase();
    return (
      params.color === CONNECTION_KIND_TABLE[byLinkType].swatch &&
      raw === CONNECTION_KIND_TABLE[byLinkType].linkType
    );
  }
  return false;
}
