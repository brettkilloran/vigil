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
  /** Folder face + palette dot (same color so picker matches canvas). */
  swatch: string;
  /** Neon edge / HUD ring on clip-path and flap. */
  border: string;
};

/** Parse `oklch(L C H)` / `oklch(L C H / a)` from our scheme strings. */
function parseOklch(swatch: string): { L: number; C: number } | null {
  const m = swatch.trim().match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([-.\d]+)/i);
  if (!m) return null;
  return { L: Number(m[1]), C: Number(m[2]) };
}

/**
 * Picks near-white or near-black ink from the face swatch so titles and UI stay readable.
 * Hand-tuned `fg` per scheme drifted on saturated midtones; this keys off OKLCH L and chroma.
 */
export function contrastingFolderInk(swatch: string): string {
  const o = parseOklch(swatch);
  if (!o) return "oklch(0.12 0.04 260)";
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
    swatch: "oklch(0.54 0 0)",
    border: "oklch(0.76 0 0)",
  },
  {
    id: "white",
    label: "Ice prism",
    swatch: "oklch(0.99 0.03 230)",
    border: "oklch(0.72 0.18 250)",
  },
  {
    id: "wine",
    label: "Scarlet",
    swatch: "oklch(0.52 0.34 25)",
    border: "oklch(0.72 0.36 25)",
  },
  {
    id: "coral",
    label: "Tangerine",
    swatch: "oklch(0.68 0.32 48)",
    border: "oklch(0.86 0.30 48)",
  },
  {
    id: "amber",
    label: "Lemon voltage",
    swatch: "oklch(0.91 0.21 102)",
    border: "oklch(0.62 0.28 102)",
  },
  {
    id: "forest",
    label: "Emerald",
    swatch: "oklch(0.55 0.32 150)",
    border: "oklch(0.78 0.30 150)",
  },
  {
    id: "lime",
    label: "Chartreuse",
    swatch: "oklch(0.84 0.30 128)",
    border: "oklch(0.62 0.28 128)",
  },
  {
    id: "cyan",
    label: "Aqua neon",
    swatch: "oklch(0.74 0.22 198)",
    border: "oklch(0.90 0.18 198)",
  },
  {
    id: "ocean",
    label: "Cobalt",
    swatch: "oklch(0.52 0.30 262)",
    border: "oklch(0.72 0.32 262)",
  },
  {
    id: "midnight",
    label: "Indigo pulse",
    swatch: "oklch(0.42 0.32 278)",
    border: "oklch(0.64 0.34 278)",
  },
  {
    id: "violet",
    label: "Electric violet",
    swatch: "oklch(0.52 0.34 305)",
    border: "oklch(0.76 0.34 305)",
  },
  {
    id: "magenta",
    label: "Hot magenta",
    swatch: "oklch(0.58 0.35 328)",
    border: "oklch(0.78 0.34 328)",
  },
  {
    id: "rose",
    label: "Hyper pink",
    swatch: "oklch(0.62 0.32 2)",
    border: "oklch(0.82 0.28 2)",
  },
  {
    id: "parchment",
    label: "Peach pop",
    swatch: "oklch(0.80 0.20 55)",
    border: "oklch(0.62 0.26 45)",
  },
];

const SCHEME_BY_ID: Record<FolderColorSchemeId, FolderColorSchemeMeta> = Object.fromEntries(
  FOLDER_COLOR_SCHEMES.map((s) => [s.id, s]),
) as Record<FolderColorSchemeId, FolderColorSchemeMeta>;

export function folderNodeStyleForScheme(
  scheme: FolderColorSchemeId | null | undefined,
): CSSProperties | undefined {
  if (!scheme) return undefined;
  const s = SCHEME_BY_ID[scheme];
  if (!s) return undefined;
  return {
    "--folder-bg": s.swatch,
    "--folder-border": s.border,
    "--folder-tab": s.swatch,
    "--folder-fg": contrastingFolderInk(s.swatch),
  } as CSSProperties;
}
