/** Shared button/panel recipes for Vigil chrome. */
import { cx } from "@/src/lib/cx";

export type VigilButtonRecipeOptions = {
  variant?: "neutral" | "primary" | "danger" | "ghost" | "subtle";
  size?: "xs" | "sm" | "md" | "lg" | "icon" | "pill";
  tone?: "glass" | "solid" | "menu" | "focus-light" | "focus-dark";
  active?: boolean;
  forceState?: "default" | "hover" | "active";
  className?: string;
};

export function vigilButtonRecipe({
  variant = "neutral",
  size = "md",
  tone = "glass",
  active = false,
  forceState = "default",
  className,
}: VigilButtonRecipeOptions = {}) {
  return cx(className ?? "", "vigil-btn");
}

export function vigilButtonDataAttrs({
  variant = "neutral",
  size = "md",
  tone = "glass",
  active = false,
  forceState = "default",
}: Omit<VigilButtonRecipeOptions, "className"> = {}) {
  return {
    "data-variant": variant,
    "data-size": size,
    "data-tone": tone,
    "data-active": active ? "true" : undefined,
    "data-force-state": forceState !== "default" ? forceState : undefined,
  };
}

/** Vertical rule between toolbar groups (hidden on very narrow rows). */
export const VIGIL_TOOLBAR_DIVIDER = "hidden h-7 w-px shrink-0 bg-[var(--vigil-border)] sm:block";

export const VIGIL_GLASS_PANEL =
  "rounded-[var(--sys-radius-md)] border border-[var(--sem-border-subtle)] bg-[var(--sem-surface-elevated)] backdrop-blur-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.4)]";

/** TipTap row inside note cards (compact). */
export const VIGIL_EDITOR_TOOLBAR_BTN = cx(
  "vigil-btn",
  "min-h-[var(--sys-control-height-xs)] px-1.5 py-0.5 text-[11px] font-medium text-[inherit]",
);

/** Icon-only control in the note format bar (min touch target). */
export const VIGIL_EDITOR_TOOLBAR_ICON_BTN = cx(
  "vigil-btn",
  "h-8 w-8 shrink-0 border-transparent text-[inherit]",
);

export const VIGIL_EDITOR_TOOLBAR_BTN_ON = "border-[var(--vigil-card-border)] bg-black/[0.08]";

/** ALL-CAPS metadata labels (image detail, entity fields, etc.). */
export const VIGIL_METADATA_LABEL = "text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--vigil-muted)]";

/** ~15px icon in toolbar chips and modal headers (matches main toolbar). */
export const VIGIL_CHROME_ICON = "size-[15px] shrink-0 opacity-90";

/** Legacy constants mapped to recipe defaults during migration. */
export const VIGIL_CHIP_BTN = cx("vigil-btn", "min-h-9 px-3 py-1.5");
export const VIGIL_BTN_ICON = cx("vigil-btn", "h-9 w-9 border-transparent");
export const VIGIL_BTN_ICON_ACTIVE = "data-[active=true]:bg-[var(--cmp-button-primary-bg-default)]";
export const VIGIL_ADD_BTN = cx("vigil-btn", "px-3 py-1.5");
export const VIGIL_ICON_GHOST_BTN = cx("vigil-btn", "h-8 w-8 border-transparent");
