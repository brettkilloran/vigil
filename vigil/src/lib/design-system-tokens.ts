/**
 * Server-safe color literals for DB defaults and HTML strings where `var(--token)` is not usable.
 * Keep in sync with `:root` in `app/globals.css` (`--sys-color-*` and syntax hues).
 */
export const DS_COLOR = {
  itemDefaultNote: "oklch(1 0 0)",
  itemDefaultSticky: "oklch(0.87 0.2 163)",
  codeSampleKeyword: "oklch(0.63 0.18 320)",
  codeSampleName: "oklch(0.81 0.12 85)",
  codeSampleProperty: "oklch(0.74 0.12 55)",
  codeSampleString: "oklch(0.77 0.15 145)",
  codeSampleComment: "oklch(0.47 0.02 264)",
  codeSampleCaption: "oklch(0.452 0 0)",
} as const;
