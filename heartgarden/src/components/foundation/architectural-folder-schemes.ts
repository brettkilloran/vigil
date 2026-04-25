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

export type FolderColorSchemeMeta = {
  id: FolderColorSchemeId;
  label: string;
  /** Short line for thread picker catalog + tooltips — how to *use* the color, not only its name. */
  usageHint: string;
  /** Folder face + palette dot (same color so picker matches canvas). */
  swatch: string;
  /** Neon edge / HUD ring on clip-path and flap. */
  border: string;
};

/** Parse `oklch(L C H)` / `oklch(L C H / a)` from our scheme strings. */
function parseOklch(swatch: string): { L: number; C: number } | null {
  const m = swatch.trim().match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([-.\d]+)/i);
  if (!m) {
    return null;
  }
  return { L: Number(m[1]), C: Number(m[2]) };
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
    id: "gray",
    label: "Neutral gray",
    usageHint: "Low-emphasis ties and background links",
    swatch: "oklch(0.54 0 0)",
    border: "oklch(0.76 0 0)",
  },
  {
    id: "white",
    label: "Pearl",
    usageHint: "Clean contrast; archival or administrative paths",
    swatch: "oklch(0.99 0.03 230)",
    border: "oklch(0.72 0.18 250)",
  },
  {
    id: "wine",
    label: "Wine",
    usageHint: "Duty, institutions, bloodlines",
    swatch: "oklch(0.52 0.34 25)",
    border: "oklch(0.72 0.36 25)",
  },
  {
    id: "coral",
    label: "Coral",
    usageHint: "Warm social bonds and favors",
    swatch: "oklch(0.68 0.32 48)",
    border: "oklch(0.86 0.30 48)",
  },
  {
    id: "amber",
    label: "Honey",
    usageHint: "Warnings, deadlines, slow burns",
    swatch: "oklch(0.91 0.21 102)",
    border: "oklch(0.62 0.28 102)",
  },
  {
    id: "forest",
    label: "Forest",
    usageHint: "Territories, wildlife, green paths",
    swatch: "oklch(0.55 0.32 150)",
    border: "oklch(0.78 0.30 150)",
  },
  {
    id: "lime",
    label: "Chartreuse",
    usageHint: "Odd, experimental, or comedic threads",
    swatch: "oklch(0.84 0.30 128)",
    border: "oklch(0.62 0.28 128)",
  },
  {
    id: "cyan",
    label: "Aqua",
    usageHint: "Comms, data flow, blueprints",
    swatch: "oklch(0.74 0.22 198)",
    border: "oklch(0.90 0.18 198)",
  },
  {
    id: "ocean",
    label: "Cobalt",
    usageHint: "Main spine — travel, trade, big plot",
    swatch: "oklch(0.52 0.30 262)",
    border: "oklch(0.72 0.32 262)",
  },
  {
    id: "midnight",
    label: "Midnight",
    usageHint: "Secrets, noir, after-hours links",
    swatch: "oklch(0.42 0.32 278)",
    border: "oklch(0.64 0.34 278)",
  },
  {
    id: "violet",
    label: "Violet",
    usageHint: "Arcane, weird, metaphysical ties",
    swatch: "oklch(0.52 0.34 305)",
    border: "oklch(0.76 0.34 305)",
  },
  {
    id: "magenta",
    label: "Magenta",
    usageHint: "Romance, obsession, glam",
    swatch: "oklch(0.58 0.35 328)",
    border: "oklch(0.78 0.34 328)",
  },
  {
    id: "rose",
    label: "Rose",
    usageHint: "Care, intimacy, gentle obligations",
    swatch: "oklch(0.62 0.32 2)",
    border: "oklch(0.82 0.28 2)",
  },
  {
    id: "parchment",
    label: "Peach",
    usageHint: "History, lore, older story roads",
    swatch: "oklch(0.80 0.20 55)",
    border: "oklch(0.62 0.26 45)",
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
    "--folder-tab": s.swatch,
    "--folder-fg": contrastingFolderInk(s.swatch),
  } as CSSProperties;
}
