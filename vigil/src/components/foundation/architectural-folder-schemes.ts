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
  fg: string;
};

/**
 * Marathon-style neons: `swatch` is the actual folder surface; `border` is the electric rim.
 * Dock order (after system-default swatch): black-adjacent → neutral gray → hue sweep → paper/white.
 */
export const FOLDER_COLOR_SCHEMES: FolderColorSchemeMeta[] = [
  {
    id: "midnight",
    label: "Void",
    swatch: "oklch(0.36 0.22 278)",
    border: "oklch(0.62 0.26 278)",
    fg: "oklch(0.97 0.04 278)",
  },
  {
    id: "gray",
    label: "Gray",
    swatch: "oklch(0.56 0.012 260)",
    border: "oklch(0.74 0.04 260)",
    fg: "oklch(0.12 0.02 260)",
  },
  {
    id: "wine",
    label: "Rupture",
    swatch: "oklch(0.45 0.24 22)",
    border: "oklch(0.62 0.28 22)",
    fg: "oklch(0.99 0.04 22)",
  },
  {
    id: "rose",
    label: "Flare",
    swatch: "oklch(0.48 0.24 2)",
    border: "oklch(0.66 0.26 2)",
    fg: "oklch(0.99 0.05 2)",
  },
  {
    id: "coral",
    label: "Burn",
    swatch: "oklch(0.58 0.26 48)",
    border: "oklch(0.76 0.26 48)",
    fg: "oklch(0.12 0.06 48)",
  },
  {
    id: "amber",
    label: "Pulse",
    swatch: "oklch(0.72 0.28 90)",
    border: "oklch(0.88 0.26 95)",
    fg: "oklch(0.12 0.07 90)",
  },
  {
    id: "lime",
    label: "Spill",
    swatch: "oklch(0.58 0.28 128)",
    border: "oklch(0.82 0.26 128)",
    fg: "oklch(0.14 0.07 128)",
  },
  {
    id: "forest",
    label: "Shard",
    swatch: "oklch(0.42 0.24 145)",
    border: "oklch(0.64 0.26 145)",
    fg: "oklch(0.97 0.06 145)",
  },
  {
    id: "cyan",
    label: "Uplink",
    swatch: "oklch(0.48 0.22 195)",
    border: "oklch(0.72 0.24 195)",
    fg: "oklch(0.99 0.05 195)",
  },
  {
    id: "ocean",
    label: "Cascade",
    swatch: "oklch(0.42 0.24 262)",
    border: "oklch(0.66 0.26 262)",
    fg: "oklch(0.98 0.03 262)",
  },
  {
    id: "violet",
    label: "Shift",
    swatch: "oklch(0.44 0.26 302)",
    border: "oklch(0.66 0.28 302)",
    fg: "oklch(0.98 0.05 302)",
  },
  {
    id: "magenta",
    label: "Sync",
    swatch: "oklch(0.50 0.30 328)",
    border: "oklch(0.68 0.28 328)",
    fg: "oklch(0.99 0.06 328)",
  },
  {
    id: "parchment",
    label: "Datum",
    swatch: "oklch(0.86 0.06 230)",
    border: "oklch(0.52 0.20 260)",
    fg: "oklch(0.12 0.05 260)",
  },
  {
    id: "white",
    label: "White",
    swatch: "oklch(0.99 0.004 260)",
    border: "oklch(0.58 0.10 260)",
    fg: "oklch(0.16 0.02 260)",
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
    "--folder-fg": s.fg,
  } as CSSProperties;
}
