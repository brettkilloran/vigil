# Design System Token Inventory

This document outlines all currently defined design-system-related tokens.

## Sources

- Global token source: `app/globals.css`
- Module-scoped legacy token source: `src/components/foundation/ArchitecturalCanvasApp.module.css`

## 1) Primitive Tokens (`--sys-*`)

### Color

- `--sys-color-black`
- `--sys-color-white`
- `--sys-color-neutral-950`
- `--sys-color-neutral-900`
- `--sys-color-neutral-800`
- `--sys-color-neutral-700`
- `--sys-color-neutral-500`
- `--sys-color-neutral-400`
- `--sys-color-neutral-300`
- `--sys-color-neutral-100`
- `--sys-color-accent-500`
- `--sys-color-danger-500`
- `--sys-color-danger-400`
- `--sys-color-danger-300`

### Radius

- `--sys-radius-sm`
- `--sys-radius-md`
- `--sys-radius-lg`
- `--sys-radius-full`

### Control sizing

- `--sys-control-height-xs`
- `--sys-control-height-sm`
- `--sys-control-height-md`
- `--sys-control-height-lg`
- `--sys-control-pad-x-xs`
- `--sys-control-pad-x-sm`
- `--sys-control-pad-x-md`
- `--sys-control-pad-x-lg`

### Motion

- `--sys-motion-duration-fast`
- `--sys-motion-duration-normal`
- `--sys-motion-ease-standard`

## 2) Semantic Tokens (`--sem-*`)

### Surface

- `--sem-surface-base`
- `--sem-surface-glass`
- `--sem-surface-elevated`
- `--sem-surface-muted-hover`
- `--sem-surface-muted-press`

### Text

- `--sem-text-primary`
- `--sem-text-secondary`
- `--sem-text-muted`
- `--sem-text-onAccent`

### Border

- `--sem-border-subtle`
- `--sem-border-strong`

### Focus

- `--sem-focus-ring`
- `--sem-focus-ring-width`
- `--sem-focus-ring-offset`

## 3) Component Tokens (`--cmp-button-*`)

### Neutral variant

- `--cmp-button-neutral-bg-default`
- `--cmp-button-neutral-bg-hover`
- `--cmp-button-neutral-bg-active`
- `--cmp-button-neutral-bg-disabled`
- `--cmp-button-neutral-fg-default`
- `--cmp-button-neutral-fg-hover`
- `--cmp-button-neutral-fg-active`
- `--cmp-button-neutral-fg-disabled`
- `--cmp-button-neutral-border-default`
- `--cmp-button-neutral-border-hover`
- `--cmp-button-neutral-border-active`
- `--cmp-button-neutral-border-disabled`

### Ghost variant

- `--cmp-button-ghost-bg-default`
- `--cmp-button-ghost-bg-hover`
- `--cmp-button-ghost-bg-active`
- `--cmp-button-ghost-bg-disabled`
- `--cmp-button-ghost-fg-default`
- `--cmp-button-ghost-fg-hover`
- `--cmp-button-ghost-fg-active`
- `--cmp-button-ghost-fg-disabled`
- `--cmp-button-ghost-border-default`
- `--cmp-button-ghost-border-hover`
- `--cmp-button-ghost-border-active`
- `--cmp-button-ghost-border-disabled`

### Subtle variant

- `--cmp-button-subtle-bg-default`
- `--cmp-button-subtle-bg-hover`
- `--cmp-button-subtle-bg-active`
- `--cmp-button-subtle-bg-disabled`
- `--cmp-button-subtle-fg-default`
- `--cmp-button-subtle-fg-hover`
- `--cmp-button-subtle-fg-active`
- `--cmp-button-subtle-fg-disabled`
- `--cmp-button-subtle-border-default`
- `--cmp-button-subtle-border-hover`
- `--cmp-button-subtle-border-active`
- `--cmp-button-subtle-border-disabled`

### Primary variant

- `--cmp-button-primary-bg-default`
- `--cmp-button-primary-bg-hover`
- `--cmp-button-primary-bg-active`
- `--cmp-button-primary-bg-disabled`
- `--cmp-button-primary-fg-default`
- `--cmp-button-primary-fg-hover`
- `--cmp-button-primary-fg-active`
- `--cmp-button-primary-fg-disabled`
- `--cmp-button-primary-border-default`
- `--cmp-button-primary-border-hover`
- `--cmp-button-primary-border-active`
- `--cmp-button-primary-border-disabled`

### Danger variant

- `--cmp-button-danger-bg-default`
- `--cmp-button-danger-bg-hover`
- `--cmp-button-danger-bg-active`
- `--cmp-button-danger-bg-disabled`
- `--cmp-button-danger-fg-default`
- `--cmp-button-danger-fg-hover`
- `--cmp-button-danger-fg-active`
- `--cmp-button-danger-fg-disabled`
- `--cmp-button-danger-border-default`
- `--cmp-button-danger-border-hover`
- `--cmp-button-danger-border-active`
- `--cmp-button-danger-border-disabled`

### Tone helpers

- `--cmp-button-focus-light-bg-default`
- `--cmp-button-focus-light-bg-hover`
- `--cmp-button-focus-light-bg-active`
- `--cmp-button-focus-light-fg-default`
- `--cmp-button-focus-light-fg-hover`
- `--cmp-button-focus-light-fg-active`
- `--cmp-button-focus-dark-bg-default`
- `--cmp-button-focus-dark-bg-hover`
- `--cmp-button-focus-dark-bg-active`
- `--cmp-button-focus-dark-fg-default`
- `--cmp-button-focus-dark-fg-hover`
- `--cmp-button-focus-dark-fg-active`

### Context usage rule

- Use `focus-light` for icon actions rendered on light card surfaces (default/task/media themes) to guarantee visible hover/active affordances.
- Use `focus-dark` for icon actions rendered on dark card surfaces (code theme) to preserve contrast parity.
- Avoid opacity-based overrides for contextual action buttons; rely on tone tokens for state legibility.

## 4) Compatibility + Legacy Global Tokens

These still exist globally for compatibility and incremental migration.

- `--bg-base`
- `--background`
- `--foreground`
- `--vigil-muted`
- `--vigil-label`
- `--vigil-border`
- `--vigil-btn-bg`
- `--vigil-btn-fg`
- `--vigil-btn-border`
- `--vigil-snap`
- `--vigil-canvas`
- `--vigil-grid-color`
- `--vigil-elevated`
- `--vigil-glass-border`
- `--vigil-card-bg`
- `--vigil-card-border`
- `--vigil-card-header-bg`
- `--vigil-folder-tab-bg`
- `--theme-default-bg`
- `--theme-default-text`
- `--theme-default-border`
- `--theme-task-bg`
- `--theme-task-text`
- `--theme-task-border`
- `--theme-media-bg`
- `--theme-media-text`
- `--theme-media-border`

## 5) Runtime Recipe Variables (private to `.vigil-btn`)

These are internal mapping variables used by the button recipe. They should not be consumed directly by app components.

- `--btn-bg-default`
- `--btn-bg-hover`
- `--btn-bg-active`
- `--btn-bg-disabled`
- `--btn-fg-default`
- `--btn-fg-hover`
- `--btn-fg-active`
- `--btn-fg-disabled`
- `--btn-border-default`
- `--btn-border-hover`
- `--btn-border-active`
- `--btn-border-disabled`
- `--btn-height`
- `--btn-radius`
- `--btn-pad-x`
- `--btn-font-size`
- `--btn-font-weight`
- `--btn-gap`

## 6) Module-Scoped Legacy Tokens (still present)

These are scoped to foundation CSS module and are not part of the global DS token namespace.

From `src/components/foundation/ArchitecturalCanvasApp.module.css`:

- `--bg-base`
- `--grid-color`
- `--ui-glass-bg`
- `--ui-glass-border`
- `--text-main`
- `--text-muted`
- `--accent`
- `--theme-default-bg`
- `--theme-default-text`
- `--theme-default-border`
- `--theme-code-bg`
- `--theme-code-text`
- `--theme-code-border`
- `--theme-task-bg`
- `--theme-task-text`
- `--theme-task-border`
- `--theme-media-bg`
- `--theme-media-text`
- `--theme-media-border`

## Notes

- The authoritative button system now lives in `--sys-*`, `--sem-*`, and `--cmp-button-*` under `app/globals.css`.
- `--vigil-*` and module-scoped tokens remain for compatibility and should be consolidated over time.
