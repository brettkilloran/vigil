/** Card elevation: border-forward, Vercel-ish soft lift (spike). */

export type CardShadowMode = "light" | "dark";

const PRESETS: Record<
  CardShadowMode,
  { rest: string; selected: string; lift: string }
> = {
  light: {
    rest: "0 0 0 1px color-mix(in srgb, var(--vigil-card-border) 100%, transparent), 0 1px 2px rgba(0,0,0,0.04)",
    selected:
      "0 0 0 2px var(--vigil-snap), 0 1px 2px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.06)",
    lift: "0 0 0 2px var(--vigil-snap), 0 4px 12px rgba(0,0,0,0.08), 0 12px 28px rgba(0,0,0,0.08)",
  },
  dark: {
    rest: "0 0 0 1px color-mix(in srgb, var(--vigil-card-border) 100%, transparent), 0 1px 2px rgba(0,0,0,0.4)",
    selected:
      "0 0 0 2px var(--vigil-snap), 0 2px 8px rgba(0,0,0,0.45), 0 8px 20px rgba(0,0,0,0.35)",
    lift: "0 0 0 2px var(--vigil-snap), 0 6px 16px rgba(0,0,0,0.5), 0 14px 32px rgba(0,0,0,0.4)",
  },
};

export function cardBoxShadow(opts: {
  mode: CardShadowMode;
  selected: boolean;
  lifting: boolean;
}): string {
  const S = PRESETS[opts.mode];
  if (opts.lifting) {
    if (opts.selected) return S.lift;
    return opts.mode === "light"
      ? "0 0 0 1px color-mix(in srgb, var(--vigil-card-border) 100%, transparent), 0 4px 14px rgba(0,0,0,0.1)"
      : "0 0 0 1px color-mix(in srgb, var(--vigil-card-border) 100%, transparent), 0 8px 22px rgba(0,0,0,0.45)";
  }
  if (opts.selected) return S.selected;
  return S.rest;
}
