/** Card elevation — architectural dark canvas, light cards. */

const REST =
  "var(--sem-shadow-md), var(--sem-shadow-sm)";
const SELECTED =
  "0 0 0 2px var(--vigil-snap), 0 4px 12px color-mix(in srgb, var(--sys-color-black) 25%, transparent), var(--sem-shadow-sm)";
const LIFT =
  "var(--sem-shadow-xl), 0 8px 16px color-mix(in srgb, var(--sys-color-black) 30%, transparent)";

export function cardBoxShadow(opts: {
  selected: boolean;
  lifting: boolean;
}): string {
  if (opts.lifting) return LIFT;
  if (opts.selected) return SELECTED;
  return REST;
}
