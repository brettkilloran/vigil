import type { CSSProperties } from "react";

export interface OrdoV7StaplePlacementOptions {
  /** Full span of hashed extra tilt in degrees (default 14 → ±7° from center). */
  extraDegRangeDeg?: number;
  /** Horizontal jitter span in px (default 50 → ±25px). */
  offsetXPx?: number;
  /** Vertical jitter span in px (default 22 → ±11px). */
  offsetYPx?: number;
}

/**
 * Per-card staple / nail position + tilt: stable from seed (SSR-safe), independent of tape-only ±3°.
 * Combines tape rotation with hashed extra angle (~±7° by default) and offset — same contract as canvas Ordo v7 staple.
 */
export function ordoV7StaplePlacementFromSeed(
  seed: string,
  tapeRotationDeg?: number,
  options?: OrdoV7StaplePlacementOptions
): CSSProperties {
  let h = 2_166_136_261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16_777_619) >>> 0;
  }
  const mix = (salt: number) => {
    let x = Math.imul(h ^ salt, 2_246_822_519) >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 2_246_822_519) >>> 0;
    return x >>> 0;
  };
  const hDeg = mix(0x5b_d1_e9_95);
  const hX = mix(0xcb_f2_9c_e4);
  const hY = mix(0x9e_37_79_b9);
  const degRange = options?.extraDegRangeDeg ?? 14;
  const extraDeg = ((hDeg % 1001) / 1001 - 0.5) * degRange;
  const deg = (tapeRotationDeg ?? 0) + extraDeg;
  const oxRange = options?.offsetXPx ?? 50;
  const oyRange = options?.offsetYPx ?? 22;
  const offsetX = ((hX % 2001) / 2001 - 0.5) * oxRange;
  const offsetY = ((hY % 2001) / 2001 - 0.5) * oyRange;
  return {
    "--loc-ordo-v7-staple-deg": `${deg.toFixed(2)}deg`,
    "--loc-ordo-v7-staple-ox": `${offsetX.toFixed(2)}px`,
    "--loc-ordo-v7-staple-oy": `${offsetY.toFixed(2)}px`,
  } as CSSProperties;
}
