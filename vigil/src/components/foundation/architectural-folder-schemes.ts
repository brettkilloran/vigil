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
 * High-chroma OKLCH throughout (incl. neutrals as tinted “electric” grays / whites).
 * `label` = tooltip / a11y names (occult flavor). `swatch` = face; `border` = rim.
 */
export const FOLDER_COLOR_SCHEMES: FolderColorSchemeMeta[] = [
  {
    id: "midnight",
    label: "Witching hour",
    swatch: "oklch(0.32 0.28 278)",
    border: "oklch(0.70 0.32 278)",
    fg: "oklch(0.98 0.06 278)",
  },
  {
    id: "gray",
    label: "Grave dust",
    swatch: "oklch(0.50 0.12 265)",
    border: "oklch(0.78 0.20 285)",
    fg: "oklch(0.12 0.06 265)",
  },
  {
    id: "white",
    label: "Salt circle",
    swatch: "oklch(0.97 0.05 230)",
    border: "oklch(0.62 0.22 250)",
    fg: "oklch(0.14 0.07 260)",
  },
  {
    id: "wine",
    label: "Blood oath",
    swatch: "oklch(0.48 0.30 22)",
    border: "oklch(0.74 0.32 22)",
    fg: "oklch(0.99 0.06 22)",
  },
  {
    id: "coral",
    label: "Pyre ember",
    swatch: "oklch(0.62 0.30 48)",
    border: "oklch(0.84 0.28 48)",
    fg: "oklch(0.12 0.09 48)",
  },
  {
    id: "amber",
    label: "Sun-disk honey",
    swatch: "oklch(0.78 0.32 92)",
    border: "oklch(0.91 0.30 98)",
    fg: "oklch(0.14 0.09 92)",
  },
  {
    id: "lime",
    label: "Belladonna",
    swatch: "oklch(0.70 0.34 128)",
    border: "oklch(0.88 0.30 128)",
    fg: "oklch(0.12 0.10 128)",
  },
  {
    id: "forest",
    label: "Yew root",
    swatch: "oklch(0.44 0.30 145)",
    border: "oklch(0.72 0.32 145)",
    fg: "oklch(0.98 0.09 145)",
  },
  {
    id: "cyan",
    label: "Tidal sigil",
    swatch: "oklch(0.56 0.28 195)",
    border: "oklch(0.80 0.28 195)",
    fg: "oklch(0.99 0.09 195)",
  },
  {
    id: "ocean",
    label: "Leviathan deep",
    swatch: "oklch(0.48 0.30 262)",
    border: "oklch(0.74 0.32 262)",
    fg: "oklch(0.99 0.07 262)",
  },
  {
    id: "violet",
    label: "Third eye",
    swatch: "oklch(0.50 0.32 302)",
    border: "oklch(0.76 0.34 302)",
    fg: "oklch(0.99 0.08 302)",
  },
  {
    id: "magenta",
    label: "Foxglove ward",
    swatch: "oklch(0.58 0.34 328)",
    border: "oklch(0.78 0.32 328)",
    fg: "oklch(0.99 0.09 328)",
  },
  {
    id: "rose",
    label: "Thorn philtre",
    swatch: "oklch(0.60 0.30 2)",
    border: "oklch(0.78 0.32 2)",
    fg: "oklch(0.14 0.09 2)",
  },
  {
    id: "parchment",
    label: "Grimoire page",
    swatch: "oklch(0.90 0.12 95)",
    border: "oklch(0.58 0.26 75)",
    fg: "oklch(0.14 0.08 260)",
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
