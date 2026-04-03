/** Shared Tailwind class strings for consistent chrome (toolbar, menus, chips). */

/** Vertical rule between toolbar groups (hidden on very narrow rows). */
export const VIGIL_TOOLBAR_DIVIDER =
  "hidden h-7 w-px shrink-0 bg-[var(--vigil-border)] sm:block";

export const VIGIL_CHIP_BTN =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--vigil-btn-border)] bg-[var(--vigil-btn-bg)] px-3 py-1.5 text-xs font-medium text-[var(--vigil-btn-fg)] shadow-sm transition-colors duration-150 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vigil-snap)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] active:scale-[0.98]";

export const VIGIL_GLASS_PANEL =
  "rounded-xl border border-[var(--vigil-border)] bg-[var(--vigil-elevated)]/95 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-md dark:bg-[var(--vigil-elevated)]/95 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_28px_rgba(0,0,0,0.35)]";

/** TipTap row inside note cards (compact). */
export const VIGIL_EDITOR_TOOLBAR_BTN =
  "rounded-md border border-transparent px-1.5 py-0.5 text-[11px] font-medium text-[var(--foreground)] transition-colors hover:bg-black/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vigil-snap)]/35 dark:hover:bg-white/[0.1]";

/** Icon-only control in the note format bar (min touch target). */
export const VIGIL_EDITOR_TOOLBAR_ICON_BTN =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-[var(--foreground)] transition-colors hover:bg-black/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vigil-snap)]/35 dark:hover:bg-white/[0.1]";

export const VIGIL_EDITOR_TOOLBAR_BTN_ON =
  "border-[var(--vigil-card-border)] bg-black/[0.06] dark:bg-white/[0.08]";

/** ALL-CAPS metadata labels (image detail, entity fields, etc.). */
export const VIGIL_METADATA_LABEL =
  "text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--vigil-muted)]";

/** ~15px icon in toolbar chips and modal headers (matches main toolbar). */
export const VIGIL_CHROME_ICON =
  "size-[15px] shrink-0 opacity-90";

/** Compact square dismiss / icon control on glass (scratch, timeline, etc.). */
export const VIGIL_ICON_GHOST_BTN =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-[var(--vigil-muted)] transition-colors hover:bg-black/[0.07] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vigil-snap)]/35 dark:hover:bg-white/[0.1]";
