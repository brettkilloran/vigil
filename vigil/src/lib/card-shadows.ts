/** Card elevation — architectural dark canvas, light cards. */

const REST =
  "0 4px 12px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.3)";
const SELECTED =
  "0 0 0 2px var(--vigil-snap), 0 4px 12px rgba(0,0,0,0.25), 0 1px 2px rgba(0,0,0,0.3)";
const LIFT =
  "0 20px 40px rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.3)";

export function cardBoxShadow(opts: {
  selected: boolean;
  lifting: boolean;
}): string {
  if (opts.lifting) return LIFT;
  if (opts.selected) return SELECTED;
  return REST;
}
