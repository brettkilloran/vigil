import type { CSSProperties } from "react";

/** Omit = canvas default (--folder-* from shell tokens). */
export type FolderColorSchemeId =
  | "midnight"
  | "ocean"
  | "forest"
  | "wine"
  | "amber"
  | "violet"
  | "rose"
  | "parchment"
  | "cyan"
  | "lime"
  | "magenta"
  | "coral"
  | "white"
  | "gray";

export interface FolderColorSchemeMeta {
  /** Neon edge / HUD ring on clip-path and flap. */
  border: string;
  id: FolderColorSchemeId;
  label: string;
  /** Folder face + palette dot (same color so picker matches canvas). */
  swatch: string;
  /** Short line for thread picker catalog + tooltips — how to *use* the color, not only its name. */
  usageHint: string;
}

/** Parse `oklch(L C H)` / `oklch(L C H / a)` from our scheme strings. */
function parseOklch(swatch: string): { L: number; C: number } | null {
  const m = swatch.trim().match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([-.\d]+)/i);
  if (!m) {
    return null;
  }
  return { C: Number(m[2]), L: Number(m[1]) };
}

/**
 * Picks near-white or near-black ink from the face swatch so titles and UI stay readable.
 * Hand-tuned `fg` per scheme drifted on saturated midtones; this keys off OKLCH L and chroma.
 */
export function contrastingFolderInk(swatch: string): string {
  const o = parseOklch(swatch);
  if (!o) {
    return "oklch(0.12 0.04 260)";
  }
  const { L, C } = o;

  if (L >= 0.66) {
    return "oklch(0.12 0.04 260)";
  }
  if (L <= 0.52) {
    return "oklch(0.98 0.02 260)";
  }
  if (C >= 0.26 && L >= 0.5) {
    return "oklch(0.98 0.02 260)";
  }
  return "oklch(0.12 0.04 260)";
}

/**
 * Saturated OKLCH rainbow: gray + white (after classic black), then ROYGBIV + pink + peach.
 * High chroma, Dribbble-style pops; rims are lighter / more electric. 14 + classic = 15 (3×5).
 */
export const FOLDER_COLOR_SCHEMES: FolderColorSchemeMeta[] = [
  {
    border: "oklch(0.76 0 0)",
    id: "gray",
    label: "Neutral gray",
    swatch: "oklch(0.54 0 0)",
    usageHint: "Low-emphasis ties and background links",
  },
  {
    border: "oklch(0.72 0.18 250)",
    id: "white",
    label: "Pearl",
    swatch: "oklch(0.99 0.03 230)",
    usageHint: "Clean contrast; archival or administrative paths",
  },
  {
    border: "oklch(0.72 0.36 25)",
    id: "wine",
    label: "Wine",
    swatch: "oklch(0.52 0.34 25)",
    usageHint: "Duty, institutions, bloodlines",
  },
  {
    border: "oklch(0.86 0.30 48)",
    id: "coral",
    label: "Coral",
    swatch: "oklch(0.68 0.32 48)",
    usageHint: "Warm social bonds and favors",
  },
  {
    border: "oklch(0.62 0.28 102)",
    id: "amber",
    label: "Honey",
    swatch: "oklch(0.91 0.21 102)",
    usageHint: "Warnings, deadlines, slow burns",
  },
  {
    border: "oklch(0.78 0.30 150)",
    id: "forest",
    label: "Forest",
    swatch: "oklch(0.55 0.32 150)",
    usageHint: "Territories, wildlife, green paths",
  },
  {
    border: "oklch(0.62 0.28 128)",
    id: "lime",
    label: "Chartreuse",
    swatch: "oklch(0.84 0.30 128)",
    usageHint: "Odd, experimental, or comedic threads",
  },
  {
    border: "oklch(0.90 0.18 198)",
    id: "cyan",
    label: "Aqua",
    swatch: "oklch(0.74 0.22 198)",
    usageHint: "Comms, data flow, blueprints",
  },
  {
    border: "oklch(0.72 0.32 262)",
    id: "ocean",
    label: "Cobalt",
    swatch: "oklch(0.52 0.30 262)",
    usageHint: "Main spine — travel, trade, big plot",
  },
  {
    border: "oklch(0.64 0.34 278)",
    id: "midnight",
    label: "Midnight",
    swatch: "oklch(0.42 0.32 278)",
    usageHint: "Secrets, noir, after-hours links",
  },
  {
    border: "oklch(0.76 0.34 305)",
    id: "violet",
    label: "Violet",
    swatch: "oklch(0.52 0.34 305)",
    usageHint: "Arcane, weird, metaphysical ties",
  },
  {
    border: "oklch(0.78 0.34 328)",
    id: "magenta",
    label: "Magenta",
    swatch: "oklch(0.58 0.35 328)",
    usageHint: "Romance, obsession, glam",
  },
  {
    border: "oklch(0.82 0.28 2)",
    id: "rose",
    label: "Rose",
    swatch: "oklch(0.62 0.32 2)",
    usageHint: "Care, intimacy, gentle obligations",
  },
  {
    border: "oklch(0.62 0.26 45)",
    id: "parchment",
    label: "Peach",
    swatch: "oklch(0.80 0.20 55)",
    usageHint: "History, lore, older story roads",
  },
];

/** Copy for the un-tinted “black mirror” default (folders + threads). */
export const FOLDER_COLOR_BLACK_MIRROR_HINT =
  "Default ink — untyped links; lets card chrome stay dominant";

const SCHEME_BY_ID: Record<FolderColorSchemeId, FolderColorSchemeMeta> =
  Object.fromEntries(FOLDER_COLOR_SCHEMES.map((s) => [s.id, s])) as Record<
    FolderColorSchemeId,
    FolderColorSchemeMeta
  >;

export function folderNodeStyleForScheme(
  scheme: FolderColorSchemeId | null | undefined
): CSSProperties | undefined {
  if (!scheme) {
    return;
  }
  const s = SCHEME_BY_ID[scheme];
  if (!s) {
    return;
  }
  return {
    "--folder-bg": s.swatch,
    "--folder-border": s.border,
    "--folder-fg": contrastingFolderInk(s.swatch),
    "--folder-tab": s.swatch,
  } as CSSProperties;
}
