import type { CSSProperties } from "react";

import type { ItemType } from "@/src/stores/canvas-types";

export type CardThemeKind = "default" | "task" | "media";

export function cardThemeKind(itemType: ItemType): CardThemeKind {
  switch (itemType) {
    case "checklist":
      return "task";
    case "image":
    case "webclip":
      return "media";
    default:
      return "default";
  }
}

/** CSS variable names (set on card root) */
export function cardThemeCssVars(kind: CardThemeKind): CSSProperties {
  switch (kind) {
    case "task":
      return {
        ["--card-bg" as string]: "var(--theme-task-bg)",
        ["--card-fg" as string]: "var(--theme-task-text)",
        ["--card-accent" as string]: "var(--theme-task-border)",
      };
    case "media":
      return {
        ["--card-bg" as string]: "var(--theme-media-bg)",
        ["--card-fg" as string]: "var(--theme-media-text)",
        ["--card-accent" as string]: "var(--theme-media-border)",
      };
    default:
      return {
        ["--card-bg" as string]: "var(--theme-default-bg)",
        ["--card-fg" as string]: "var(--theme-default-text)",
        ["--card-accent" as string]: "var(--theme-default-border)",
      };
  }
}

export type TapeVariant = "masking" | "clear" | "dark";

export function tapeVariantForItem(
  kind: CardThemeKind,
  itemId: string,
): TapeVariant {
  void kind;
  void itemId;
  return "clear";
}

export function stableRotationDeg(itemId: string, range = 4): number {
  const h = hashString(itemId);
  const t = (h % 1000) / 1000;
  return -range / 2 + t * range;
}

export function tapeRotationDeg(itemId: string): number {
  const h = hashString(`${itemId}-tape`);
  const t = (h % 1000) / 1000;
  return -3 + t * 6;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
