/** Spatial-style whisper shadows: tight + diffuse; lift while dragging (Phase 6 slice). */

export type CardShadowMode = "light" | "dark";

const PRESETS: Record<
  CardShadowMode,
  { rest: string; selected: string; lift: string }
> = {
  light: {
    rest: "0 1px 1px rgba(0,0,0,0.04), 0 4px 18px rgba(0,0,0,0.08)",
    selected:
      "0 0 0 2px var(--vigil-snap), 0 2px 4px rgba(0,0,0,0.05), 0 10px 30px rgba(0,0,0,0.11)",
    lift: "0 0 0 2px var(--vigil-snap), 0 8px 20px rgba(0,0,0,0.12), 0 20px 48px rgba(0,0,0,0.14)",
  },
  dark: {
    rest: "0 1px 2px rgba(0,0,0,0.45), 0 5px 22px rgba(0,0,0,0.5)",
    selected:
      "0 0 0 2px var(--vigil-snap), 0 4px 14px rgba(0,0,0,0.55), 0 14px 40px rgba(0,0,0,0.55)",
    lift: "0 0 0 2px var(--vigil-snap), 0 10px 28px rgba(0,0,0,0.6), 0 24px 56px rgba(0,0,0,0.5)",
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
      ? "0 2px 6px rgba(0,0,0,0.1), 0 14px 36px rgba(0,0,0,0.16)"
      : "0 4px 14px rgba(0,0,0,0.55), 0 18px 44px rgba(0,0,0,0.55)";
  }
  if (opts.selected) return S.selected;
  return S.rest;
}
