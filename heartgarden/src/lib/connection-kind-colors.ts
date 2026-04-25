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
  /** Stable semantic family for ranking, prompts, and future field hints. */
  semanticFamily:
    | "default"
    | "social"
    | "institutional"
    | "operational"
    | "adversarial"
    | "historical";
  /**
   * Tokens for AI retrieval/generation hints. Keep terse and domain-agnostic;
   * prompts can expand these into richer prose guidance.
   */
  autopopulationKeywords: readonly string[];
};

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
        kind: "pin",
        linkType: "pin",
        label: "Pin",
        hint: "Default rope — untyped link between two cards.",
        scheme: "coral",
        semanticFamily: "default",
        autopopulationKeywords: ["default", "unspecified", "generic"],
      },
      {
        kind: "bond",
        linkType: "bond",
        label: "Bond",
        hint: "Trusted personal tie — coven, partner, or sworn ally.",
        scheme: "rose",
        semanticFamily: "social",
        autopopulationKeywords: ["trust", "loyalty", "coven", "intimacy"],
      },
      {
        kind: "affiliation",
        linkType: "affiliation",
        label: "Affiliation",
        hint: "Belongs to or aligns with an organization, bloc, or nation.",
        scheme: "ocean",
        semanticFamily: "institutional",
        autopopulationKeywords: [
          "membership",
          "alignment",
          "faction",
          "organization",
        ],
      },
      {
        kind: "contract",
        linkType: "contract",
        label: "Contract",
        hint: "Formal mission, paid work, or binding duty.",
        scheme: "gray",
        semanticFamily: "operational",
        autopopulationKeywords: ["job", "mission", "employment", "obligation"],
      },
      {
        kind: "conflict",
        linkType: "conflict",
        label: "Conflict",
        hint: "Opposition, hostile pressure, hunt, or coercion.",
        scheme: "wine",
        semanticFamily: "adversarial",
        autopopulationKeywords: [
          "rivalry",
          "hostility",
          "war",
          "coercion",
          "debt",
        ],
      },
      {
        kind: "history",
        linkType: "history",
        label: "History",
        hint: "Former ties, origins, and past events still shaping the present.",
        scheme: "parchment",
        semanticFamily: "historical",
        autopopulationKeywords: ["former", "origin", "backstory", "legacy"],
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
  // Previous picker vocabulary.
  reference: "history",
  ally: "bond",
  enemy: "conflict",
  neutral: "pin",
  quest: "contract",
  lore: "history",
  other: "history",
  // Import-era role tags.
  faction: "affiliation",
  location: "history",
  npc: "bond",
  // Planned-but-removed semantic.
  leverage: "conflict",
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
  return { L: Number(m[1]), C: Number(m[2]), H: Number(m[3]) };
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

export type CanonicalConnectionPair = {
  color: string;
  linkType: string;
};

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
