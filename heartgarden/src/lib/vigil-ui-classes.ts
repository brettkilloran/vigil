/** Shared button/panel recipes for Vigil chrome. */
import { cx } from "@/src/lib/cx";

export interface VigilButtonRecipeOptions {
  active?: boolean;
  className?: string;
  forceState?: "default" | "hover" | "active";
  size?: "xs" | "sm" | "md" | "lg" | "icon" | "pill";
  tone?: "glass" | "solid" | "menu" | "focus-light" | "focus-dark";
  variant?: "default" | "primary" | "danger" | "ghost" | "subtle";
}

export function vigilButtonRecipe(opts: VigilButtonRecipeOptions = {}) {
  const { className } = opts;
  return cx(className ?? "", "vigil-btn");
}

export function vigilButtonDataAttrs({
  variant = "default",
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
    "data-force-state": forceState === "default" ? undefined : forceState,
  };
}

/** Vertical rule between toolbar groups (hidden on very narrow rows). */
export const HEARTGARDEN_TOOLBAR_DIVIDER =
  "hidden h-7 w-px shrink-0 bg-[var(--vigil-border)] sm:block";

export const HEARTGARDEN_GLASS_PANEL =
  "rounded-[var(--sys-radius-md)] border border-[var(--sem-border-subtle)] bg-[var(--sem-surface-elevated)] backdrop-blur-[12px] shadow-[var(--sem-shadow-lg)]";

/** Command palette surface (cmdk-inspired, token-native). */
export const HEARTGARDEN_COMMAND_SURFACE = cx(
  HEARTGARDEN_GLASS_PANEL,
  "w-full max-w-2xl overflow-hidden"
);

/** Command palette option row baseline. */
export const HEARTGARDEN_COMMAND_OPTION = cx(
  "flex w-full items-start justify-start gap-2.5 rounded-[10px] px-3 py-2.5 text-left transition-colors",
  "text-[var(--sem-text-primary)]"
);

/** TipTap row inside note cards (compact). */
export const HEARTGARDEN_EDITOR_TOOLBAR_BTN = cx(
  "vigil-btn",
  "min-h-[var(--sys-control-height-xs)] px-1.5 py-0.5 text-[11px] font-medium text-[inherit]"
);

/** Icon-only control in the note format bar (min touch target). */
export const HEARTGARDEN_EDITOR_TOOLBAR_ICON_BTN = cx(
  "vigil-btn",
  "h-8 w-8 shrink-0 border-transparent text-[inherit]"
);

export const HEARTGARDEN_EDITOR_TOOLBAR_BTN_ON =
  "border-[var(--vigil-card-border)] bg-black/[0.08]";

/** ALL-CAPS metadata labels (image detail, entity fields, etc.). */
export const HEARTGARDEN_METADATA_LABEL =
  "text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--vigil-muted)]";

/** ~15px icon in toolbar chips and modal headers (matches main toolbar). */
export const HEARTGARDEN_CHROME_ICON = "size-[15px] shrink-0 opacity-90";

/** Legacy constants mapped to recipe defaults during migration. */
export const HEARTGARDEN_CHIP_BTN = cx("vigil-btn", "min-h-9 px-3 py-1.5");
export const HEARTGARDEN_BTN_ICON = cx(
  "vigil-btn",
  "h-9 w-9 border-transparent"
);
export const HEARTGARDEN_BTN_ICON_ACTIVE =
  "data-[active=true]:bg-[var(--cmp-button-primary-bg-default)]";
export const HEARTGARDEN_ADD_BTN = cx("vigil-btn", "px-3 py-1.5");
export const HEARTGARDEN_ICON_GHOST_BTN = cx(
  "vigil-btn",
  "h-8 w-8 border-transparent"
);
