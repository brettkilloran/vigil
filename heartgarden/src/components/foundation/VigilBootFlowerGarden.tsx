"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";

import styles from "./VigilBootFlowerGarden.module.css";

/** Canvas / hit grid for boot flowers — shared with `VigilAppBootScreen` poison stroke sampling. */
export const VIGIL_BOOT_FLOWER_CELL_PX = 5;
const PIXEL = VIGIL_BOOT_FLOWER_CELL_PX;
const PIXEL_PAD = 0.5;
const MAX_PARTICLES = 420;
const TICK_EVERY = 2;

/**
 * Canvas `fillStyle` often rejects `color-mix(…, var(--sys-color-accent-500), …)` → black pixels.
 * Substitute `ACCENT_PH` at draw time from `:root` (keeps parity with `app/globals.css`).
 */
const ACCENT_PH = "__VIGIL_ACCENT__";
const SYS_ACCENT_FALLBACK = "oklch(0.74 0.31 50)";
let resolvedAccentCache: string | null = null;

function readResolvedSysAccent500(): string {
  if (typeof document === "undefined") return SYS_ACCENT_FALLBACK;
  if (resolvedAccentCache !== null) return resolvedAccentCache;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--sys-color-accent-500").trim();
  resolvedAccentCache = raw.length > 0 ? raw : SYS_ACCENT_FALLBACK;
  return resolvedAccentCache;
}

export function invalidateVigilBootFlowerAccentCache(): void {
  resolvedAccentCache = null;
}

function expandBootFlowerCanvasColor(color: string): string {
  if (!color.includes(ACCENT_PH)) return color;
  return color.split(ACCENT_PH).join(readResolvedSysAccent500());
}

const SYS_ACCENT = ACCENT_PH;
const SYS_DANGER_500 = "oklch(0.577 0.245 27.33)";
const SYS_DANGER_400 = "oklch(0.704 0.191 17.7)";
const SYS_DANGER_300 = "oklch(0.793 0.133 17.7)";

/** Extra orange (saturated) to weave into blooms. */
const ORANGE_POP = "oklch(0.71 0.21 54)";
const ORANGE_MID = "oklch(0.76 0.18 58)";
const ORANGE_SOFT = "oklch(0.82 0.14 62)";

/** Original pixel-flower blues (hex — `color-mix(in oklch, …)` in canvas). */
const LEGACY_BLUE_PETAL = "#5d7df5";
const LEGACY_BLUE_HOT = "#9eb6ff";
const LEGACY_BLUE_DEEP = "#3d52c4";
const LEGACY_ROYAL_PETAL = "#3b59ff";
const LEGACY_ROYAL_HOT = "#7a9cff";
const LEGACY_ROYAL_DEEP = "#2a3eb8";
const LEGACY_SKY_PETAL = "#7fc8ff";
const LEGACY_SKY_HOT = "#c5e8ff";
const LEGACY_SKY_DEEP = "#4a9fd4";

/**
 * Stems / leaves — one pair per species, chromatic OKLCH (mirrors legacy hex variety:
 * blue-greens, olives, teals, chartreuse, blue-teal — not a shared 4-token pool).
 */
const FOLIAGE = [
  { stem: "oklch(0.31 0.09 152)", leaf: "oklch(0.44 0.14 144)" },
  { stem: "oklch(0.33 0.1 132)", leaf: "oklch(0.45 0.13 126)" },
  { stem: "oklch(0.29 0.08 162)", leaf: "oklch(0.42 0.12 154)" },
  { stem: "oklch(0.34 0.11 122)", leaf: "oklch(0.51 0.16 118)" },
  { stem: "oklch(0.3 0.09 175)", leaf: "oklch(0.44 0.13 166)" },
  { stem: "oklch(0.35 0.1 128)", leaf: "oklch(0.52 0.15 124)" },
  { stem: "oklch(0.32 0.1 212)", leaf: "oklch(0.43 0.13 206)" },
  /** Blue-named varieties: green stems so blue reads on petals, not stalks */
  { stem: "oklch(0.31 0.09 158)", leaf: "oklch(0.44 0.13 152)" },
  { stem: "oklch(0.32 0.1 162)", leaf: "oklch(0.43 0.12 156)" },
  { stem: "oklch(0.3 0.09 172)", leaf: "oklch(0.45 0.12 168)" },
  /** Magenta blooms — cool blue-green stem so hot pink doesn’t clash with foliage */
  { stem: "oklch(0.3 0.07 168)", leaf: "oklch(0.42 0.11 162)" },
  /** Rainbow rares — near-neutral stems so ROYGBV petals stay the read */
  { stem: "oklch(0.29 0.05 285)", leaf: "oklch(0.4 0.09 275)" },
  { stem: "oklch(0.29 0.06 210)", leaf: "oklch(0.4 0.09 200)" },
] as const;

/** `ap` = percentage of `a` in OKLCH mix (canvas fillStyle). */
function mixOklch(a: string, b: string, ap: number): string {
  return `color-mix(in oklch, ${a} ${ap}%, ${b})`;
}

export type VigilBootFlowerGardenHandle = {
  spawnAt: (clientX: number, clientY: number) => void;
  cutAt: (clientX: number, clientY: number) => void;
  clearAll: () => void;
};

const DEAD_CELL_COLORS = ["#2a1810", "#3d261a", "#4a3222", "#5c3e2c", "#352218"] as const;

const WITHER_MS = 960;
/** Occupied pixels within this Chebyshev distance of the 8-connected core are cut too (sparse blooms / one-cell gaps). */
const CUT_HALO_CHEBYSHEV = 5;
/** Remove growth particles if they sit this close (cells) to any cut pixel. */
const PARTICLE_CULL_MARGIN = 3;

type WitherCell = {
  r0: number;
  g0: number;
  b0: number;
  r1: number;
  g1: number;
  b1: number;
  startMs: number;
  durationMs: number;
};

/** Resolve any canvas-accepted CSS color to sRGB via a 1×1 readback (OKLCH, hex, etc.). */
function sampleCssColorToRgb(cssColor: string): { r: number; g: number; b: number } {
  if (typeof document === "undefined") return { r: 55, g: 38, b: 28 };
  const c = document.createElement("canvas");
  c.width = 1;
  c.height = 1;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { r: 55, g: 38, b: 28 };
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = expandBootFlowerCanvasColor(cssColor);
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return { r: d[0]!, g: d[1]!, b: d[2]! };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = hex.slice(1);
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

/** Brown + desaturate via lerp, then alpha-out in the final segment. */
function wiltDrawColor(w: WitherCell, nowMs: number): string {
  const rawT = Math.min(1, (nowMs - w.startMs) / w.durationMs);
  const t = 1 - (1 - rawT) ** 2.35;
  const r = Math.round(w.r0 + (w.r1 - w.r0) * t);
  const g = Math.round(w.g0 + (w.g1 - w.g0) * t);
  const b = Math.round(w.b0 + (w.b1 - w.b0) * t);
  let a = 1;
  if (rawT > 0.78) {
    a = 1 - (rawT - 0.78) / 0.22;
  }
  if (a >= 0.998 && rawT < 1) return `rgb(${r},${g},${b})`;
  return `rgba(${r},${g},${b},${Math.max(0, a)})`;
}

const NEIGHBOR8: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function findNearestOccupied(
  gx: number,
  gy: number,
  occupied: Map<string, string>,
  maxRadius: number,
): [number, number] | null {
  if (occupied.has(cellKey(gx, gy))) return [gx, gy];
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = gx + dx;
        const y = gy + dy;
        const k = cellKey(x, y);
        if (occupied.has(k)) return [x, y];
      }
    }
  }
  return null;
}

/**
 * 8-connected BFS can miss occupied “specks” separated by a 1px void from the main mass.
 * Grab every occupied cell within `halo` (Chebyshev) of the core component so cuts don’t leave orphans.
 */
function expandOccupiedWithinChebyshevHaloOfCore(
  coreKeys: string[],
  occupied: Map<string, string>,
  halo: number,
): string[] {
  if (coreKeys.length === 0) return [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const k of coreKeys) {
    const comma = k.indexOf(",");
    if (comma < 1) continue;
    const x = Number(k.slice(0, comma));
    const y = Number(k.slice(comma + 1));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) return [...coreKeys];

  const out = new Set<string>(coreKeys);
  for (let y = minY - halo; y <= maxY + halo; y++) {
    for (let x = minX - halo; x <= maxX + halo; x++) {
      const k = cellKey(x, y);
      if (!occupied.has(k) || out.has(k)) continue;
      for (const ck of coreKeys) {
        const comma = ck.indexOf(",");
        if (comma < 1) continue;
        const cx = Number(ck.slice(0, comma));
        const cy = Number(ck.slice(comma + 1));
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= halo) {
          out.add(k);
          break;
        }
      }
    }
  }
  return [...out];
}

function particleTouchesExpandedCut(px: number, py: number, cut: Set<string>, margin: number): boolean {
  for (let dy = -margin; dy <= margin; dy++) {
    for (let dx = -margin; dx <= margin; dx++) {
      if (cut.has(cellKey(px + dx, py + dy))) return true;
    }
  }
  return false;
}

export type BloomShape =
  | "Stelix"
  | "Orbith"
  | "Dew Goblet"
  | "Quadron"
  | "Painwheel"
  | "Mourning Fan"
  | "Sperion"
  | "Duonis"
  | "Fear Lily"
  | "Grave Tears"
  | "Thorn Tiara"
  | "Bolide"
  | "Bloodsop"
  | "Soft Fang"
  | "Rethel"
  | "Zygoth"
  | "Sweet Curse"
  | "Falcith"
  | "Mirror Lotus"
  | "Glowmoth"
  | "Witch Eye"
  | "Obelon"
  | "Trikon"
  | "Ghost Petal"
  | "Prunith"
  | "Vortalis"
  | "Racemor"
  | "Blade Lily"
  | "Bonebloom"
  | "Fourfold Root"
  | "Nodion"
  | "Serpic"
  | "Sorrow Weep";

/** Bloom silhouette ids — mix of xenobotanical tokens and folk / garden names (see `paintBloomCluster`). */

export const BLOOM_SHAPES: BloomShape[] = [
  "Stelix",
  "Orbith",
  "Dew Goblet",
  "Quadron",
  "Painwheel",
  "Mourning Fan",
  "Sperion",
  "Duonis",
  "Fear Lily",
  "Grave Tears",
  "Thorn Tiara",
  "Bolide",
  "Bloodsop",
  "Soft Fang",
  "Rethel",
  "Zygoth",
  "Sweet Curse",
  "Falcith",
  "Mirror Lotus",
  "Glowmoth",
  "Witch Eye",
  "Obelon",
  "Trikon",
  "Ghost Petal",
  "Prunith",
  "Vortalis",
  "Racemor",
  "Blade Lily",
  "Bonebloom",
  "Fourfold Root",
  "Nodion",
  "Serpic",
  "Sorrow Weep",
];

type GardenRng = { s: number };

function gardenRandU01(state: GardenRng): number {
  let x = state.s | 0;
  if (x === 0) x = 0x6eed0e9d;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.s = x;
  return (x >>> 0) * (1 / 4294967296);
}

/** Mix time into the PRNG so “Clear all flowers” shifts the spawn stream. */
function gardenRandBump(state: GardenRng): void {
  const t = Date.now();
  const perf =
    Math.floor((typeof performance !== "undefined" ? performance.now() : 0) * 1000) >>> 0;
  state.s = (state.s ^ t ^ (t >>> 16) ^ perf ^ 0x9e3779b9) | 0;
  if (state.s === 0) state.s = 0x6a09e667;
}

function shuffleBloomShapeOrderMutable(order: BloomShape[], rng: GardenRng): void {
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(gardenRandU01(rng) * (i + 1));
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }
}

export type Species = {
  /** Variety label for catalog / Storybook (plain color-forward names). */
  name: string;
  stem: string;
  leaf: string;
  /** Main petal ring */
  bloom: string;
  /** Hot center (overwrites stem at tip) */
  bloomCore: string;
  /** Outer soft halo */
  bloomHalo: string;
  energyMin: number;
  energyMax: number;
  wander: number;
  upJitter: number;
  sinAmp: number;
  sinFreq: number;
  branchGate: number;
  branchEnergyMin: number;
  branchEnergyFrac: number;
  lateralRun: number;
  spike: string | null;
};

export const SPECIES: Species[] = [
  {
    name: "Periwinkle",
    stem: FOLIAGE[0].stem,
    leaf: FOLIAGE[0].leaf,
    bloom: mixOklch(LEGACY_BLUE_PETAL, "oklch(0.56 0.22 272)", 42),
    bloomCore: mixOklch(LEGACY_BLUE_HOT, SYS_ACCENT, 78),
    bloomHalo: mixOklch(LEGACY_BLUE_DEEP, ORANGE_MID, 88),
    energyMin: 18,
    energyMax: 38,
    wander: 1.15,
    upJitter: 0.45,
    sinAmp: 0.85,
    sinFreq: 0.11,
    branchGate: 0.88,
    branchEnergyMin: 14,
    branchEnergyFrac: 0.52,
    lateralRun: 0.35,
    spike: null,
  },
  {
    name: "Raspberry",
    stem: FOLIAGE[1].stem,
    leaf: FOLIAGE[1].leaf,
    bloom: mixOklch("oklch(0.62 0.26 330)", mixOklch(ORANGE_POP, SYS_ACCENT, 42), 52),
    bloomCore: mixOklch("oklch(0.8 0.14 328)", mixOklch(ORANGE_MID, SYS_DANGER_300, 35), 48),
    bloomHalo: mixOklch("oklch(0.52 0.22 328)", SYS_DANGER_400, 58),
    energyMin: 22,
    energyMax: 48,
    wander: 0.75,
    upJitter: 0.25,
    sinAmp: 0.35,
    sinFreq: 0.07,
    branchGate: 0.9,
    branchEnergyMin: 16,
    branchEnergyFrac: 0.48,
    lateralRun: 0.2,
    spike: SYS_DANGER_400,
  },
  {
    name: "Indigo",
    stem: FOLIAGE[2].stem,
    leaf: FOLIAGE[2].leaf,
    bloom: mixOklch(LEGACY_ROYAL_PETAL, "oklch(0.5 0.24 278)", 38),
    bloomCore: mixOklch(LEGACY_ROYAL_HOT, ORANGE_SOFT, 82),
    bloomHalo: mixOklch(LEGACY_ROYAL_DEEP, SYS_ACCENT, 86),
    energyMin: 16,
    energyMax: 36,
    wander: 1.4,
    upJitter: 0.55,
    sinAmp: 1.1,
    sinFreq: 0.14,
    branchGate: 0.84,
    branchEnergyMin: 12,
    branchEnergyFrac: 0.55,
    lateralRun: 0.5,
    spike: null,
  },
  {
    name: "Marigold",
    stem: FOLIAGE[3].stem,
    leaf: FOLIAGE[3].leaf,
    bloom: mixOklch("oklch(0.74 0.2 52)", ORANGE_POP, 38),
    bloomCore: mixOklch("oklch(0.82 0.19 48)", ORANGE_MID, 44),
    bloomHalo: mixOklch("oklch(0.68 0.18 46)", ORANGE_POP, 50),
    energyMin: 14,
    energyMax: 30,
    wander: 1.6,
    upJitter: 0.7,
    sinAmp: 1.25,
    sinFreq: 0.17,
    branchGate: 0.82,
    branchEnergyMin: 10,
    branchEnergyFrac: 0.58,
    lateralRun: 0.65,
    spike: null,
  },
  {
    name: "Sky",
    stem: FOLIAGE[4].stem,
    leaf: FOLIAGE[4].leaf,
    bloom: mixOklch(LEGACY_SKY_PETAL, "oklch(0.66 0.12 236)", 40),
    bloomCore: mixOklch(LEGACY_SKY_HOT, SYS_ACCENT, 76),
    bloomHalo: mixOklch(LEGACY_SKY_DEEP, ORANGE_SOFT, 88),
    energyMin: 20,
    energyMax: 42,
    wander: 1.0,
    upJitter: 0.4,
    sinAmp: 0.65,
    sinFreq: 0.1,
    branchGate: 0.86,
    branchEnergyMin: 14,
    branchEnergyFrac: 0.5,
    lateralRun: 0.4,
    spike: null,
  },
  {
    name: "Poppy",
    stem: FOLIAGE[5].stem,
    leaf: FOLIAGE[5].leaf,
    bloom: mixOklch("oklch(0.52 0.24 27)", SYS_DANGER_400, 50),
    bloomCore: mixOklch("oklch(0.76 0.17 28)", SYS_DANGER_300, 46),
    bloomHalo: mixOklch(SYS_DANGER_500, "oklch(0.4 0.15 24)", 55),
    energyMin: 12,
    energyMax: 28,
    wander: 1.9,
    upJitter: 0.85,
    sinAmp: 1.4,
    sinFreq: 0.2,
    branchGate: 0.8,
    branchEnergyMin: 9,
    branchEnergyFrac: 0.6,
    lateralRun: 0.7,
    spike: null,
  },
  {
    name: "Plum",
    stem: FOLIAGE[6].stem,
    leaf: FOLIAGE[6].leaf,
    bloom: mixOklch("oklch(0.58 0.22 305)", mixOklch(ORANGE_MID, SYS_ACCENT, 45), 55),
    bloomCore: mixOklch("oklch(0.78 0.12 310)", mixOklch(SYS_DANGER_300, ORANGE_SOFT, 40), 42),
    bloomHalo: mixOklch(LEGACY_ROYAL_DEEP, mixOklch("oklch(0.5 0.2 300)", SYS_DANGER_400, 50), 48),
    energyMin: 24,
    energyMax: 52,
    wander: 0.65,
    upJitter: 0.3,
    sinAmp: 0.45,
    sinFreq: 0.09,
    branchGate: 0.87,
    branchEnergyMin: 15,
    branchEnergyFrac: 0.5,
    lateralRun: 0.25,
    spike: SYS_DANGER_500,
  },
  /** Helio-cultivar yellow; green stem/leaf from FOLIAGE[7]. */
  {
    name: "Buttercup",
    stem: FOLIAGE[7].stem,
    leaf: FOLIAGE[7].leaf,
    bloom: mixOklch("oklch(0.8 0.2 96)", mixOklch(ORANGE_SOFT, SYS_ACCENT, 62), 72),
    bloomCore: mixOklch("oklch(0.93 0.14 100)", ORANGE_SOFT, 58),
    bloomHalo: mixOklch("oklch(0.66 0.17 92)", ORANGE_MID, 52),
    energyMin: 18,
    energyMax: 38,
    wander: 1.12,
    upJitter: 0.44,
    sinAmp: 0.82,
    sinFreq: 0.11,
    branchGate: 0.88,
    branchEnergyMin: 14,
    branchEnergyFrac: 0.52,
    lateralRun: 0.35,
    spike: null,
  },
  /** Acid chartreuse (hue ~124–142). */
  {
    name: "Chartreuse",
    stem: FOLIAGE[8].stem,
    leaf: FOLIAGE[8].leaf,
    bloom: mixOklch("oklch(0.72 0.28 132)", "oklch(0.66 0.24 140)", 46),
    bloomCore: mixOklch("oklch(0.9 0.2 126)", ORANGE_SOFT, 76),
    bloomHalo: mixOklch("oklch(0.52 0.22 138)", "oklch(0.44 0.18 148)", 52),
    energyMin: 16,
    energyMax: 36,
    wander: 1.35,
    upJitter: 0.52,
    sinAmp: 1.05,
    sinFreq: 0.14,
    branchGate: 0.84,
    branchEnergyMin: 12,
    branchEnergyFrac: 0.55,
    lateralRun: 0.48,
    spike: null,
  },
  /** Sky-thread blues. */
  {
    name: "Azure",
    stem: FOLIAGE[9].stem,
    leaf: FOLIAGE[9].leaf,
    bloom: mixOklch(LEGACY_SKY_PETAL, SYS_ACCENT, 86),
    bloomCore: mixOklch(LEGACY_SKY_HOT, SYS_ACCENT, 84),
    bloomHalo: mixOklch(LEGACY_SKY_DEEP, SYS_ACCENT, 82),
    energyMin: 20,
    energyMax: 42,
    wander: 1.02,
    upJitter: 0.42,
    sinAmp: 0.62,
    sinFreq: 0.1,
    branchGate: 0.86,
    branchEnergyMin: 14,
    branchEnergyFrac: 0.5,
    lateralRun: 0.42,
    spike: null,
  },
  /** Saturated magenta (hue ~348–358). */
  {
    name: "Fuchsia",
    stem: FOLIAGE[10].stem,
    leaf: FOLIAGE[10].leaf,
    bloom: mixOklch("oklch(0.58 0.3 352)", "oklch(0.5 0.26 348)", 42),
    bloomCore: mixOklch("oklch(0.84 0.17 2)", SYS_ACCENT, 74),
    bloomHalo: mixOklch("oklch(0.42 0.24 350)", SYS_DANGER_400, 58),
    energyMin: 18,
    energyMax: 40,
    wander: 1.18,
    upJitter: 0.48,
    sinAmp: 0.92,
    sinFreq: 0.12,
    branchGate: 0.86,
    branchEnergyMin: 13,
    branchEnergyFrac: 0.53,
    lateralRun: 0.4,
    spike: null,
  },
  /**
   * Rare Spectrum — red / chartreuse / blue-violet layers in pixel blooms.
   * Spawn: see `VIGIL_BOOT_FLOWER_RARE_SPAWN_EACH` (last `VIGIL_BOOT_FLOWER_RARE_COUNT` species).
   */
  {
    name: "Spectrum",
    stem: FOLIAGE[11].stem,
    leaf: FOLIAGE[11].leaf,
    bloom: mixOklch("oklch(0.6 0.28 28)", SYS_DANGER_400, 46),
    bloomCore: mixOklch("oklch(0.84 0.22 128)", ORANGE_SOFT, 68),
    bloomHalo: mixOklch("oklch(0.52 0.26 278)", LEGACY_BLUE_PETAL, 52),
    energyMin: 20,
    energyMax: 44,
    wander: 1.25,
    upJitter: 0.55,
    sinAmp: 1.0,
    sinFreq: 0.13,
    branchGate: 0.85,
    branchEnergyMin: 14,
    branchEnergyFrac: 0.54,
    lateralRun: 0.45,
    spike: null,
  },
  {
    name: "Confetti",
    stem: FOLIAGE[12].stem,
    leaf: FOLIAGE[12].leaf,
    bloom: mixOklch("oklch(0.5 0.36 322)", LEGACY_ROYAL_PETAL, 18),
    bloomCore: mixOklch("oklch(0.9 0.2 195)", LEGACY_SKY_HOT, 22),
    bloomHalo: mixOklch("oklch(0.64 0.32 128)", ORANGE_POP, 15),
    energyMin: 18,
    energyMax: 42,
    wander: 1.22,
    upJitter: 0.52,
    sinAmp: 0.98,
    sinFreq: 0.125,
    branchGate: 0.855,
    branchEnergyMin: 13,
    branchEnergyFrac: 0.535,
    lateralRun: 0.43,
    spike: null,
  },
];

/** Last this many `SPECIES` entries use `VIGIL_BOOT_FLOWER_RARE_SPAWN_EACH` each (Spectrum / Confetti). */
export const VIGIL_BOOT_FLOWER_RARE_COUNT = 2;
/** Per-spawn probability for each rare tail species (~2% ⇒ ~4% any rare with count 2). */
export const VIGIL_BOOT_FLOWER_RARE_SPAWN_EACH = 0.02;

function rollBootFlowerSpeciesIndex(rng: GardenRng): number {
  const n = SPECIES.length;
  const rareN = VIGIL_BOOT_FLOWER_RARE_COUNT;
  if (rareN < 1 || n <= rareN) {
    return Math.floor(gardenRandU01(rng) * n);
  }
  const pEach = VIGIL_BOOT_FLOWER_RARE_SPAWN_EACH;
  const cap = pEach * rareN;
  const u = gardenRandU01(rng);
  const firstRare = n - rareN;
  for (let i = 0; i < rareN; i++) {
    if (u < pEach * (i + 1)) return firstRare + i;
  }
  const u2 = (u - cap) / (1 - cap);
  const commonN = n - rareN;
  return Math.min(commonN - 1, Math.floor(u2 * commonN));
}

type Particle = {
  x: number;
  y: number;
  energy: number;
  species: number;
  rnd: number[];
  age: number;
  dir: number;
  bloomShape: BloomShape;
  /** Rare: extra foliage pixels along the stem while growing */
  vineLeafy: boolean;
  /** Rare: thorn pixels along the stem */
  vineThorny: boolean;
};

/** Rare stem traits — rolled once per new root spawn, copied to branches. */
const VINE_LEAFY_CHANCE = 0.072;
const VINE_THORNY_CHANCE = 0.054;

/**
 * Counter-gust vs default wind-swept lean: ~15% extra chance each tick for leftward lateral,
 * steeper-up vertical jitter, and trying the left-ish escape first when the stem is blocked.
 */
const GROWTH_GUST_LEFT_LATERAL = 0.15;
const GROWTH_GUST_UP_CHANCE = 0.15;
/** When up-gust hits, pull `r2` down so `(r2 - 0.5) * upJitter` skews toward −y (climb). */
const GROWTH_GUST_UP_R2_SHIFT = 0.12;
const GROWTH_COLLIDE_LEFT_FIRST = 0.15;

/** Thorn tint: almost stem, slight leaf lift so it still reads as a point. */
function thornColorForSpec(spec: Species): string {
  return mixOklch(spec.stem, spec.leaf, 78);
}

function paintRareStemDecor(
  spec: Species,
  nx: number,
  ny: number,
  p: Particle,
  tryPaint: (x: number, y: number, color: string) => boolean,
) {
  if (p.vineLeafy && p.rnd[p.age % 10]! < 0.088) {
    const side = p.dir;
    const leaf = spec.leaf;
    const r3 = p.rnd[(p.age + 3) % 10]!;
    const r7 = p.rnd[(p.age + 7) % 10]!;
    // Wider leaf pad on the outward side (2×2-ish blade + extension)
    tryPaint(nx + side, ny, leaf);
    tryPaint(nx + side * 2, ny, leaf);
    tryPaint(nx + side, ny + 1, leaf);
    tryPaint(nx + side * 2, ny + 1, leaf);
    if (r3 > 0.42) tryPaint(nx + side * 3, ny, leaf);
    if (r7 > 0.38) {
      tryPaint(nx - side, ny, leaf);
      tryPaint(nx - side, ny + 1, leaf);
      if (r3 > 0.55) tryPaint(nx - side * 2, ny, leaf);
    }
    if (p.rnd[(p.age + 1) % 10]! > 0.5) tryPaint(nx, ny + 1, leaf);
  }
  if (p.vineThorny && p.rnd[(p.age + 5) % 10]! < 0.085) {
    const th = thornColorForSpec(spec);
    const out = p.dir * (p.rnd[(p.age + 2) % 10]! > 0.5 ? 1 : -1);
    tryPaint(nx + out, ny, th);
    if (p.rnd[(p.age + 9) % 10]! < 0.22) tryPaint(nx + out * 2, ny + 1, th);
  }
}

function cellKey(x: number, y: number) {
  return `${x},${y}`;
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  cssW: number,
  cssH: number,
) {
  if (x < 0 || y < 0) return;
  const px = x * PIXEL + PIXEL_PAD;
  const py = y * PIXEL + PIXEL_PAD;
  if (px >= cssW || py >= cssH) return;
  const sz = PIXEL - PIXEL_PAD * 2;
  ctx.fillStyle = expandBootFlowerCanvasColor(color);
  ctx.fillRect(px, py, sz, sz);
}

/**
 * Paints occupied garden cells, then CRT-style bands using source-atop so only
 * non-transparent flower pixels are modulated (never the boot text or void).
 */
function flushGardenCanvas(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  occupied: Map<string, string>,
  withering: Map<string, WitherCell>,
  nowMs: number,
  tSec: number,
  scanEnabled: boolean,
) {
  ctx.clearRect(0, 0, cssW, cssH);

  const done: string[] = [];
  for (const [k, w] of withering) {
    if (nowMs - w.startMs >= w.durationMs) done.push(k);
  }
  for (const k of done) {
    withering.delete(k);
    occupied.delete(k);
  }

  occupied.forEach((color, k) => {
    const comma = k.indexOf(",");
    if (comma < 1) return;
    const x = Number(k.slice(0, comma));
    const y = Number(k.slice(comma + 1));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const w = withering.get(k);
    const drawColor = w ? wiltDrawColor(w, nowMs) : color;
    drawCell(ctx, x, y, drawColor, cssW, cssH);
  });

  if (!scanEnabled || occupied.size === 0) return;

  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const linePitch = 4 + Math.sin(tSec * 1.22) * 0.65;
  const phase = tSec * 3.85;
  const band = 2;
  for (let py = 0; py < cssH; py += band) {
    let scanBand =
      Math.sin((6.2831853 * py) / linePitch + phase + Math.sin(py * 0.014 + tSec * 2.35) * 0.55) * 0.5 +
      0.5;
    scanBand = Math.max(0, Math.min(1, (scanBand - 0.18) / 0.64));
    const dim = (1 - (0.82 + scanBand * 0.18)) * 0.48;
    if (dim < 0.012) continue;
    ctx.fillStyle = `rgba(0,0,0,${dim})`;
    ctx.fillRect(0, py, cssW, Math.min(band, cssH - py));
  }
  ctx.restore();
}

type BloomKind = "full" | "mini";

type PaintFn = (x: number, y: number, color: string) => void;

/** Stelix — vertical raceme (stem grows up = −y). */
function paintShapeSpike(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  const h = mini ? 2 : 4;
  paint(cx, cy, spec.bloomCore);
  for (let i = 1; i <= h; i++) {
    const c = i <= (mini ? 1 : 2) ? spec.bloom : i === h ? spec.bloomHalo : spec.bloomCore;
    paint(cx, cy - i, c);
    if (!mini && rnd[i % 10]! > 0.35) {
      const side = rnd[(i + 3) % 10]! > 0.5 ? 1 : -1;
      paint(cx + side, cy - i, spec.bloomHalo);
    }
  }
  if (!mini) {
    paint(cx - 1, cy - 1, spec.bloom);
    paint(cx + 1, cy - 1, spec.bloom);
  }
}

/** Flat daisy / cornflower: dark eye, petal ring. */
function paintShapeDisk(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  paint(cx, cy, spec.bloomHalo);
  const ring = mini
    ? ([
        [1, 0],
        [-1, 0],
        [0, -1],
        [0, 1],
      ] as const)
    : ([
        [2, 0],
        [-2, 0],
        [0, -2],
        [0, 2],
        [1, -2],
        [-1, -2],
        [2, -1],
        [-2, -1],
        [1, 2],
        [-1, 2],
        [2, 1],
        [-2, 1],
      ] as const);
  for (const [dx, dy] of ring) {
    if (rnd[Math.abs(dx + dy + 5) % 10]! > (mini ? 0.05 : 0.12)) {
      paint(cx + dx, cy + dy, spec.bloom);
    }
  }
  if (!mini) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, -1],
      [0, 1],
      [1, -1],
      [-1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      if (rnd[(dx + 8) % 10]! > 0.15) paint(cx + dx, cy + dy, spec.bloomCore);
    }
  }
}

/** Dew Goblet — mass below the attachment. */
function paintShapeBell(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  paint(cx, cy, spec.bloomCore);
  paint(cx, cy + 1, spec.bloom);
  if (!mini) {
    paint(cx, cy + 2, spec.bloom);
    paint(cx - 1, cy + 1, spec.bloom);
    paint(cx + 1, cy + 1, spec.bloom);
    paint(cx, cy + 3, spec.bloomHalo);
    paint(cx - 1, cy + 2, spec.bloomHalo);
    paint(cx + 1, cy + 2, spec.bloomHalo);
  }
  if (rnd[0]! > 0.25) paint(cx, cy - 1, spec.bloomHalo);
  if (!mini && rnd[1]! > 0.4) {
    paint(cx - 2, cy + 1, spec.bloomHalo);
    paint(cx + 2, cy + 1, spec.bloomHalo);
  }
}

/** Buttercup-ish cruciform. */
function paintShapeCross(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  const arm = mini ? 2 : 3;
  paint(cx, cy, spec.bloomCore);
  for (let i = 1; i <= arm; i++) {
    const c = i === arm ? spec.bloomHalo : spec.bloom;
    paint(cx, cy - i, c);
    paint(cx, cy + i, spec.bloom);
    paint(cx - i, cy, c);
    paint(cx + i, cy, spec.bloom);
  }
  if (!mini && rnd[2]! > 0.35) {
    paint(cx - 1, cy - 1, spec.bloomHalo);
    paint(cx + 1, cy - 1, spec.bloomHalo);
    paint(cx - 1, cy + 1, spec.bloomHalo);
    paint(cx + 1, cy + 1, spec.bloomHalo);
  }
}

/** Thistle / star: long rays + core. */
function paintShapeStar(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  const rays: [number, number][] = mini
    ? [
        [0, -2],
        [2, 0],
        [0, 2],
        [-2, 0],
      ]
    : [
        [0, -3],
        [1, -3],
        [-1, -3],
        [3, 0],
        [3, 1],
        [3, -1],
        [0, 3],
        [-3, 0],
        [-3, 1],
        [-3, -1],
        [2, -2],
        [-2, -2],
        [2, 2],
        [-2, 2],
      ];
  paint(cx, cy, spec.bloomCore);
  for (const [dx, dy] of rays) {
    if (mini || rnd[Math.abs(dx + dy) % 10]! > 0.08) {
      paint(cx + dx, cy + dy, rnd[5]! > 0.5 ? spec.bloom : spec.bloomHalo);
    }
  }
}

/** Asymmetric fan to one side. */
function paintShapeFan(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  const flip = rnd[3]! > 0.5 ? 1 : -1;
  const reach = mini ? 2 : 3;
  paint(cx, cy, spec.bloomCore);
  for (let i = 1; i <= reach; i++) {
    paint(cx + flip * i, cy, spec.bloom);
    paint(cx + flip * i, cy - 1, spec.bloomCore);
    if (!mini) {
      paint(cx + flip * i, cy - 2, spec.bloomHalo);
      paint(cx + flip * i, cy + 1, spec.bloomHalo);
    }
  }
  if (!mini) {
    paint(cx + flip * 2, cy - 3, spec.bloom);
    paint(cx + flip, cy - 3, spec.bloomHalo);
  }
}

/** Loose constellation above the tip. */
function paintShapeSpray(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  const n = mini ? 5 : 12;
  paint(cx, cy, spec.bloomCore);
  for (let i = 0; i < n; i++) {
    const dx = Math.round((rnd[i % 10]! - 0.5) * (mini ? 3 : 5));
    let dy = -Math.max(1, Math.round(rnd[(i + 4) % 10]! * (mini ? 2 : 5)));
    if (dx === 0 && dy === 0) dy = -1;
    const c = rnd[(i + 2) % 10]! > 0.55 ? spec.bloom : rnd[(i + 6) % 10]! > 0.5 ? spec.bloomCore : spec.bloomHalo;
    paint(cx + dx, cy + dy, c);
  }
}

/** Two offset lobes (violets / paired blooms). */
function paintShapeTwin(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  const spread = mini ? 1 : 2;
  paint(cx, cy, spec.bloomCore);
  const oy = rnd[7]! > 0.5 ? -1 : 0;
  paint(cx - spread, cy + oy, spec.bloom);
  paint(cx + spread, cy + oy, spec.bloom);
  paint(cx - spread, cy - 1 + oy, spec.bloomHalo);
  paint(cx + spread, cy - 1 + oy, spec.bloomHalo);
  if (!mini) {
    paint(cx - spread - 1, cy + oy, spec.bloomHalo);
    paint(cx + spread + 1, cy + oy, spec.bloomHalo);
    paint(cx, cy - 2, spec.bloom);
  }
}

/** Six-fold radial (lily / hex petal plan). */
function paintShapeLily(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  paint(cx, cy, spec.bloomCore);
  const inner: [number, number][] = [
    [1, -1],
    [2, 0],
    [1, 1],
    [-1, 1],
    [-2, 0],
    [-1, -1],
  ];
  const outer: [number, number][] = [
    [0, -3],
    [2, -2],
    [3, 0],
    [2, 2],
    [0, 3],
    [-2, 2],
    [-3, 0],
    [-2, -2],
  ];
  for (const [dx, dy] of inner) {
    if (rnd[Math.abs(dx + dy) % 10]! < (mini ? 0.04 : 0.06)) continue;
    paint(cx + dx, cy + dy, rnd[6]! > 0.45 ? spec.bloom : spec.bloomHalo);
  }
  if (!mini) {
    for (const [dx, dy] of outer) {
      if (rnd[Math.abs(dx) % 10]! < 0.08) continue;
      paint(cx + dx, cy + dy, spec.bloom);
    }
  }
}

/** Grave Tears — drip below the anchor. */
function paintShapePendant(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  paint(cx, cy, spec.bloomCore);
  const depth = mini ? 2 : 4;
  for (let i = 1; i <= depth; i++) {
    const sway = mini ? 0 : Math.round((rnd[i % 10]! - 0.5) * 2);
    const c = i >= depth - 1 ? spec.bloomHalo : spec.bloom;
    paint(cx + sway, cy + i, c);
    if (!mini && rnd[(i + 5) % 10]! > 0.5) paint(cx + sway + (rnd[8]! > 0.5 ? 1 : -1), cy + i, spec.bloomCore);
  }
}

/** Arc of upward points — tiara / statice crown. */
function paintShapeCrown(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  paint(cx, cy, spec.bloomCore);
  const peaks: [number, number][] = mini
    ? [
        [-1, -1],
        [0, -2],
        [1, -1],
      ]
    : [
        [-2, -1],
        [-2, -2],
        [-1, -3],
        [0, -3],
        [1, -3],
        [2, -2],
        [2, -1],
      ];
  for (const [dx, dy] of peaks) {
    paint(cx + dx, cy + dy, spec.bloom);
  }
  if (!mini) {
    paint(cx - 1, cy - 1, spec.bloomHalo);
    paint(cx + 1, cy - 1, spec.bloomHalo);
    if (rnd[9]! > 0.35) paint(cx, cy - 2, spec.bloomCore);
  }
}

/** Bright head + directional tail (firework streak). */
function paintShapeComet(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  const tx = rnd[0]! > 0.5 ? 1 : -1;
  const ty = -1;
  const len = mini ? 3 : 5;
  paint(cx, cy, spec.bloomCore);
  paint(cx + tx, cy + ty, spec.bloom);
  for (let i = 2; i <= len; i++) {
    const c = i >= len - 1 ? spec.bloomHalo : spec.bloom;
    paint(cx + tx * i, cy + ty * i, c);
    if (!mini && i % 2 === 0 && rnd[i % 10]! > 0.4) paint(cx + tx * i + ty, cy + ty * i + tx, c);
  }
}

/** Tight dense ball — all inner cells filled. */
function paintShapePompom(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  const r = mini ? 1 : 2;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const cheb = Math.max(Math.abs(dx), Math.abs(dy));
      if (cheb > r) continue;
      const mix = rnd[Math.abs(dx * 5 + dy) % 10]!;
      const c = cheb === 0 ? spec.bloomCore : mix > 0.55 ? spec.bloom : spec.bloomHalo;
      paint(cx + dx, cy + dy, c);
    }
  }
}

/** Orchid: narrow column + wide lower lip. */
function paintShapeOrchid(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  paint(cx, cy - 1, spec.bloomCore);
  paint(cx, cy, spec.bloom);
  if (mini) {
    paint(cx - 1, cy + 1, spec.bloomHalo);
    paint(cx + 1, cy + 1, spec.bloomHalo);
    return;
  }
  for (const dx of [-2, -1, 0, 1, 2]) {
    paint(cx + dx, cy + 1, spec.bloom);
  }
  paint(cx - 1, cy + 2, spec.bloomHalo);
  paint(cx, cy + 2, spec.bloomCore);
  paint(cx + 1, cy + 2, spec.bloomHalo);
  if (rnd[2]! > 0.4) paint(cx - 2, cy + 1, spec.bloomHalo);
  if (rnd[3]! > 0.4) paint(cx + 2, cy + 1, spec.bloomHalo);
}

/** Umbel: many short rays from one node (Queen Anne’s lace). */
function paintShapeUmbel(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  const dist = mini ? 1 : 2;
  const dirs: [number, number][] = [
    [0, -dist],
    [dist, 0],
    [0, dist],
    [-dist, 0],
    [1, -1],
    [-1, -1],
    [1, 1],
    [-1, 1],
  ];
  paint(cx, cy, spec.bloomCore);
  for (const [dx, dy] of dirs) {
    if (rnd[Math.abs(dx + dy + 6) % 10]! < (mini ? 0.05 : 0.1)) continue;
    paint(cx + dx, cy + dy, spec.bloom);
    if (!mini && dist > 1) {
      const hx = dx === 0 ? 0 : Math.sign(dx);
      const hy = dy === 0 ? 0 : Math.sign(dy);
      paint(cx + dx - hx, cy + dy - hy, spec.bloomHalo);
    }
  }
}

/** Stepped lightning upward. */
function paintShapeZigzag(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  const steps: [number, number][] = mini
    ? [
        [0, 0],
        [-1, -1],
        [0, -2],
      ]
    : [
        [0, 0],
        [1, -1],
        [0, -2],
        [-1, -3],
        [0, -4],
        [1, -5],
        [-1, -6],
      ];
  for (let i = 0; i < steps.length; i++) {
    const [dx, dy] = steps[i]!;
    const c = i === 0 ? spec.bloomCore : i % 2 === 0 ? spec.bloom : spec.bloomHalo;
    paint(cx + dx, cy + dy, c);
  }
}

/**
 * Sweet Curse — compact heart silhouette; two lobes, cleft, single-cell tip (−y = up).
 * `BloomShape` id: `"Sweet Curse"`.
 */
function paintShapeHeart(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  if (mini) {
    for (const [dx, dy, c] of [
      [-1, -2, spec.bloomHalo],
      [0, -2, spec.bloomCore],
      [1, -2, spec.bloomHalo],
      [-1, -1, spec.bloom],
      [0, -1, spec.bloomCore],
      [1, -1, spec.bloom],
      [0, 0, spec.bloomCore],
      [0, 1, spec.bloom],
    ] as const) {
      paint(cx + dx, cy + dy, c);
    }
    return;
  }
  const cells: [number, number, string][] = [
    [-1, -3, spec.bloomHalo],
    [0, -3, spec.bloomCore],
    [1, -3, spec.bloomHalo],
    [-2, -2, spec.bloomHalo],
    [-1, -2, spec.bloom],
    [0, -2, spec.bloomCore],
    [1, -2, spec.bloom],
    [2, -2, spec.bloomHalo],
    [-2, -1, spec.bloom],
    [-1, -1, spec.bloomCore],
    [0, -1, spec.bloom],
    [1, -1, spec.bloomCore],
    [2, -1, spec.bloom],
    [-1, 0, spec.bloom],
    [0, 0, spec.bloomCore],
    [1, 0, spec.bloom],
    [0, 1, spec.bloomCore],
    [0, 2, spec.bloom],
  ];
  for (const [dx, dy, c] of cells) {
    paint(cx + dx, cy + dy, c);
  }
}

/** Thin crescent arc — moon petal. */
function paintShapeCrescent(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  const flip = rnd[5]! > 0.5 ? 1 : -1;
  if (mini) {
    paint(cx, cy, spec.bloomCore);
    paint(cx + flip, cy - 1, spec.bloom);
    paint(cx + flip * 2, cy, spec.bloomHalo);
    return;
  }
  const arc: [number, number][] = [
    [2 * flip, -1],
    [1 * flip, -2],
    [0, -2],
    [-1 * flip, -2],
    [-2 * flip, -1],
    [-2 * flip, 0],
    [-1 * flip, 1],
  ];
  paint(cx, cy, spec.bloomCore);
  for (const [dx, dy] of arc) {
    paint(cx + dx, cy + dy, spec.bloom);
  }
  if (rnd[7]! > 0.35) paint(cx - flip, cy - 1, spec.bloomHalo);
}

/** Lotus: wide horizontal bowl, low petals east-west. */
function paintShapeLotus(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  paint(cx, cy, spec.bloomCore);
  if (mini) {
    paint(cx - 2, cy, spec.bloom);
    paint(cx - 1, cy - 1, spec.bloomHalo);
    paint(cx + 1, cy - 1, spec.bloomHalo);
    paint(cx + 2, cy, spec.bloom);
    return;
  }
  for (const dx of [-3, -2, -1, 1, 2, 3]) {
    paint(cx + dx, cy, spec.bloom);
  }
  paint(cx - 2, cy - 1, spec.bloomHalo);
  paint(cx - 1, cy - 1, spec.bloom);
  paint(cx, cy - 1, spec.bloomCore);
  paint(cx + 1, cy - 1, spec.bloom);
  paint(cx + 2, cy - 1, spec.bloomHalo);
  paint(cx - 1, cy + 1, spec.bloomHalo);
  paint(cx + 1, cy + 1, spec.bloomHalo);
  if (rnd[1]! > 0.4) paint(cx - 3, cy - 1, spec.bloomHalo);
  if (rnd[2]! > 0.4) paint(cx + 3, cy - 1, spec.bloomHalo);
}

function specSheen(spec: Species, bloomMixPct: number): string {
  return mixOklch(spec.bloom, spec.bloomHalo, bloomMixPct);
}

/** One hot pixel so “alien” varietals read at a glance vs classic blooms. */
function alienBeacon(spec: Species): string {
  return mixOklch(SYS_ACCENT, spec.bloomCore, 34);
}

/** Bioluminescent speckling — dense field, far halo, strong leaf vs bloom contrast. */
function paintShapeBiolume(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  paint(cx, cy, mixOklch(spec.bloomCore, SYS_ACCENT, 88));
  const spots: [number, number][] = mini
    ? [
        [1, -1],
        [-1, -1],
        [2, 0],
        [-2, 0],
        [0, -2],
        [1, 1],
        [-1, 1],
        [2, -2],
        [-2, -2],
      ]
    : [
        [2, -2],
        [-2, -2],
        [3, 0],
        [-3, 0],
        [0, -3],
        [1, -3],
        [-1, -3],
        [2, 1],
        [-2, 1],
        [1, 2],
        [-1, 2],
        [0, 2],
        [3, -1],
        [-3, -1],
        [4, -1],
        [-4, -1],
        [0, -4],
        [3, 2],
        [-3, 2],
        [2, -4],
        [-2, -4],
      ];
  for (let i = 0; i < spots.length; i++) {
    const [dx, dy] = spots[i]!;
    if (rnd[(i + 2) % 10]! < (mini ? 0.03 : 0.02)) continue;
    const t = rnd[(i + 7) % 10]!;
    const c =
      t < 0.35
        ? spec.leaf
        : t < 0.58
          ? spec.bloomHalo
          : t < 0.82
            ? spec.bloom
            : specSheen(spec, 22);
    paint(cx + dx, cy + dy, c);
  }
  paint(cx, cy - (mini ? 2 : 3), alienBeacon(spec));
  if (!mini) {
    paint(cx, cy - 1, spec.bloom);
    paint(cx - 1, cy, spec.bloomHalo);
    paint(cx + 1, cy, spec.bloomHalo);
  }
}

/** Horizontal veils — tall stack, wide bands, stark row-to-row hue jumps. */
function paintShapeVeil(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  const rows = mini ? ([-2, -1, 0] as const) : ([-4, -3, -2, -1, 0, 1] as const);
  for (const dy of rows) {
    const spread = mini ? 3 : 3 + Math.floor(rnd[(dy + 11) % 10]! * 4);
    for (let dx = -spread; dx <= spread; dx++) {
      const wisp = rnd[(Math.abs(dx + dy * 2) + 4) % 10]!;
      if (wisp < 0.05 + Math.abs(dy) * 0.025) continue;
      const c =
        dy <= -3
          ? spec.bloomHalo
          : dy === -2
            ? specSheen(spec, 30)
            : dy === -1
              ? spec.bloom
              : dy === 0
                ? spec.bloomCore
                : dy === 1
                  ? mixOklch(spec.leaf, spec.bloom, 45)
                  : spec.leaf;
      paint(cx + dx, cy + dy, c);
    }
  }
  paint(cx + (mini ? 2 : 4), cy - 2, alienBeacon(spec));
}

/** Trikon — three-arm whorl, Y silhouette reads clearly. */
function paintShapeTriskel(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  const rot = Math.floor(rnd[9]! * 3);
  const armSets: [number, number][][] = [
    [
      [0, -1],
      [0, -2],
      [1, -3],
      [2, -3],
      [2, -4],
      [1, -5],
    ],
    [
      [1, 0],
      [2, 0],
      [3, 1],
      [3, 2],
      [4, 2],
      [4, 3],
    ],
    [
      [-1, 0],
      [-2, 0],
      [-3, 1],
      [-3, 2],
      [-4, 2],
      [-4, 3],
    ],
  ];
  const armsMini: [number, number][][] = [
    [
      [0, -1],
      [1, -2],
      [2, -3],
    ],
    [
      [1, 0],
      [2, 1],
      [3, 2],
    ],
    [
      [-1, 0],
      [-2, 1],
      [-3, 2],
    ],
  ];
  const arms = mini ? armsMini : armSets;
  paint(cx, cy, spec.bloomCore);
  for (let a = 0; a < 3; a++) {
    const idx = (a + rot) % 3;
    const segs = arms[idx]!;
    for (let i = 0; i < segs.length; i++) {
      const [dx, dy] = segs[i]!;
      const c =
        i === 0
          ? spec.bloom
          : i >= segs.length - 1
            ? spec.leaf
            : rnd[(a * 3 + i) % 10]! > 0.32
              ? spec.bloomHalo
              : mixOklch(spec.bloomCore, spec.bloom, 52);
      paint(cx + dx, cy + dy, c);
    }
    const [ex, ey] = segs[segs.length - 1]!;
    paint(cx + ex, cy + ey, mixOklch(alienBeacon(spec), spec.leaf, 50));
  }
}

/** Ghost Petal — five petals opening upward (−y); split tips. */
function paintShapeSakura(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  paint(cx, cy, spec.bloomCore);
  if (mini) {
    for (const [dx, dy] of [
      [0, -2],
      [-2, -1],
      [2, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      paint(cx + dx, cy + dy, spec.bloom);
    }
    return;
  }
  for (const [dx, dy] of [
    [0, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
  ] as const) {
    paint(cx + dx, cy + dy, spec.bloomHalo);
  }
  for (const [dx, dy] of [
    [0, -3],
    [-1, -2],
    [1, -2],
    [-3, -1],
    [3, -1],
    [-2, 1],
    [2, 1],
    [-1, 2],
    [1, 2],
  ] as const) {
    if (rnd[(Math.abs(dx) + Math.abs(dy)) % 10]! > 0.06) paint(cx + dx, cy + dy, spec.bloom);
  }
  if (rnd[4]! > 0.35) paint(cx - 2, cy - 2, spec.bloomHalo);
  if (rnd[5]! > 0.35) paint(cx + 2, cy - 2, spec.bloomHalo);
}

/** Prunith — five stubbier lobes, fuller disk than Ghost Petal. */
function paintShapeUme(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  paint(cx, cy, spec.bloomCore);
  if (mini) {
    for (const [dx, dy] of [
      [0, -2],
      [-2, 0],
      [2, 0],
      [-1, 1],
      [1, 1],
    ] as const) {
      paint(cx + dx, cy + dy, spec.bloom);
    }
    return;
  }
  const inner: [number, number][] = [
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  for (const [dx, dy] of inner) {
    const c = Math.abs(dx) + Math.abs(dy) === 1 ? spec.bloom : spec.bloomHalo;
    paint(cx + dx, cy + dy, c);
  }
  const outer: [number, number][] = [
    [0, -3],
    [-2, -2],
    [2, -2],
    [-3, 0],
    [3, 0],
    [-2, 2],
    [2, 2],
    [0, 2],
  ];
  for (const [dx, dy] of outer) {
    if (rnd[Math.abs(dx + dy + 6) % 10]! > 0.1) paint(cx + dx, cy + dy, spec.bloom);
  }
}

/** Vortalis — dense core, two radiating rings, outer halo spears. */
function paintShapeKiku(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  paint(cx, cy, spec.bloomCore);
  const ring1: [number, number][] = [
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
  ];
  for (let i = 0; i < ring1.length; i++) {
    const [dx, dy] = ring1[i]!;
    paint(cx + dx, cy + dy, rnd[(i + dx + dy + 10) % 10]! > 0.45 ? spec.bloom : spec.bloomHalo);
  }
  if (mini) return;
  const ring2: [number, number][] = [
    [0, -2],
    [1, -2],
    [2, -2],
    [2, -1],
    [2, 0],
    [2, 1],
    [2, 2],
    [1, 2],
    [0, 2],
    [-1, 2],
    [-2, 2],
    [-2, 1],
    [-2, 0],
    [-2, -1],
    [-2, -2],
    [-1, -2],
  ];
  for (const [dx, dy] of ring2) {
    if (rnd[Math.abs(dx * 3 + dy) % 10]! < 0.12) continue;
    paint(cx + dx, cy + dy, spec.bloom);
  }
  for (const [dx, dy] of [
    [0, -3],
    [3, 0],
    [0, 3],
    [-3, 0],
    [3, -2],
    [-3, -2],
    [3, 2],
    [-3, 2],
  ] as const) {
    if (rnd[Math.abs(dx + dy) % 10]! > 0.25) paint(cx + dx, cy + dy, spec.bloomHalo);
  }
}

/** Racemor — parallel hanging strands (broader than Grave Tears). */
function paintShapeFuji(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  paint(cx, cy, spec.bloomCore);
  const strands: number[] = mini ? [0] : [-2, 0, 2];
  const depth = mini ? 3 : 5;
  for (const sx of strands) {
    for (let i = 1; i <= depth; i++) {
      const sway = mini ? 0 : Math.round((rnd[(i + sx + 20) % 10]! - 0.5) * 1.5);
      const c = i >= depth - 1 ? spec.bloomHalo : i <= 2 ? spec.bloom : spec.bloomCore;
      paint(cx + sx + sway, cy + i, c);
      if (!mini && rnd[(i + sx) % 10]! > 0.55) {
        paint(cx + sx + sway + (rnd[8]! > 0.5 ? 1 : -1), cy + i, spec.bloomHalo);
      }
    }
  }
}

/** Blade Lily — upright standards (−y) and lower falls (+y). */
function paintShapeIris(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  paint(cx, cy, spec.bloomCore);
  if (mini) {
    paint(cx, cy - 2, spec.bloom);
    paint(cx - 1, cy - 1, spec.bloomHalo);
    paint(cx + 1, cy - 1, spec.bloomHalo);
    paint(cx - 1, cy + 1, spec.bloom);
    paint(cx + 1, cy + 1, spec.bloom);
    return;
  }
  paint(cx, cy - 1, spec.bloomHalo);
  for (const [dx, dy] of [
    [0, -3],
    [-1, -3],
    [1, -3],
    [-2, -2],
    [2, -2],
  ] as const) {
    paint(cx + dx, cy + dy, spec.bloom);
  }
  paint(cx, cy + 1, spec.bloomHalo);
  for (const dx of [-2, -1, 0, 1, 2]) {
    paint(cx + dx, cy + 2, spec.bloom);
  }
  paint(cx - 1, cy + 3, spec.bloomHalo);
  paint(cx + 1, cy + 3, spec.bloomHalo);
  if (rnd[6]! > 0.4) paint(cx - 2, cy + 2, spec.bloomHalo);
  if (rnd[7]! > 0.4) paint(cx + 2, cy + 2, spec.bloomHalo);
}

/** Nodding bloom — core at anchor; mass droops down-diagonal (`rnd[9]` picks left/right lilt). */
function paintShapeNod(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  const f = rnd[9]! > 0.5 ? 1 : -1;
  paint(cx, cy, spec.bloomCore);
  if (mini) {
    paint(cx + f, cy + 1, spec.bloom);
    paint(cx, cy + 1, spec.bloomHalo);
    paint(cx + f * 2, cy + 2, spec.bloomHalo);
    paint(cx + f, cy + 2, spec.bloomCore);
    return;
  }
  paint(cx + f, cy + 1, spec.bloom);
  paint(cx, cy + 1, spec.bloomHalo);
  paint(cx + f * 2, cy + 1, spec.bloomHalo);
  paint(cx + f, cy + 2, spec.bloomCore);
  paint(cx + f * 2, cy + 2, spec.bloom);
  paint(cx + f * 3, cy + 2, spec.bloomHalo);
  paint(cx + f * 2, cy + 3, spec.bloom);
  paint(cx + f * 3, cy + 3, spec.bloomHalo);
  paint(cx + f * 3, cy + 4, spec.bloomCore);
  paint(cx + f * 4, cy + 3, spec.bloomHalo);
  if (rnd[1]! > 0.35) paint(cx + f, cy + 3, spec.bloomHalo);
}

/**
 * Lilting S-curve — bends out then down, then curls back; puff at the toe.
 * Horizontal mirror from `rnd[9]`.
 */
function paintShapeLilt(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  const f = rnd[9]! > 0.5 ? 1 : -1;
  const sx = (x: number) => f * x;
  paint(cx, cy, spec.bloomCore);
  if (mini) {
    paint(cx + sx(1), cy + 1, spec.bloom);
    paint(cx + sx(1), cy + 2, spec.bloomHalo);
    paint(cx + sx(2), cy + 2, spec.bloomCore);
    paint(cx + sx(2), cy + 3, spec.bloom);
    paint(cx + sx(1), cy + 3, spec.bloomHalo);
    return;
  }
  const steps: [number, number, string][] = [
    [sx(0), 1, spec.bloomHalo],
    [sx(1), 1, spec.bloom],
    [sx(1), 2, spec.bloomCore],
    [sx(2), 2, spec.bloomHalo],
    [sx(2), 3, spec.bloom],
    [sx(3), 3, spec.bloomHalo],
    [sx(3), 4, spec.bloomCore],
    [sx(3), 5, spec.bloom],
    [sx(2), 5, spec.bloomHalo],
    [sx(2), 6, spec.bloom],
    [sx(1), 6, spec.bloomHalo],
    [sx(1), 7, spec.bloomCore],
    [sx(0), 7, spec.bloomHalo],
    [sx(0), 8, spec.bloom],
    [sx(-1), 7, spec.bloomHalo],
    [sx(1), 8, spec.bloomHalo],
  ];
  for (const [dx, dy, c] of steps) {
    paint(cx + dx, cy + dy, c);
  }
}

/** Weeping shape — widens as it drops, then the lowest lip hangs past the stem line. */
function paintShapeWeep(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  const f = rnd[9]! > 0.5 ? 1 : -1;
  paint(cx, cy, spec.bloomCore);
  if (mini) {
    paint(cx, cy + 1, spec.bloom);
    paint(cx + f, cy + 2, spec.bloomHalo);
    paint(cx, cy + 2, spec.bloomCore);
    paint(cx - f, cy + 2, spec.bloomHalo);
    paint(cx + f * 2, cy + 3, spec.bloom);
    paint(cx + f, cy + 3, spec.bloom);
    return;
  }
  paint(cx, cy + 1, spec.bloomHalo);
  paint(cx - f, cy + 1, spec.bloom);
  paint(cx + f, cy + 1, spec.bloom);
  paint(cx - f, cy + 2, spec.bloomHalo);
  paint(cx, cy + 2, spec.bloom);
  paint(cx + f, cy + 2, spec.bloomHalo);
  paint(cx - f * 2, cy + 3, spec.bloom);
  paint(cx - f, cy + 3, spec.bloomCore);
  paint(cx, cy + 3, spec.bloom);
  paint(cx + f, cy + 3, spec.bloomCore);
  paint(cx + f * 2, cy + 3, spec.bloom);
  paint(cx - f * 2, cy + 4, spec.bloomHalo);
  paint(cx - f, cy + 4, spec.bloom);
  paint(cx, cy + 4, spec.bloomCore);
  paint(cx + f, cy + 4, spec.bloom);
  paint(cx + f * 2, cy + 4, spec.bloomHalo);
  paint(cx + f * 3, cy + 4, spec.bloomHalo);
  paint(cx + f * 2, cy + 5, spec.bloom);
  paint(cx + f * 3, cy + 5, spec.bloomCore);
  paint(cx + f * 4, cy + 5, spec.bloomHalo);
  if (rnd[4]! > 0.4) paint(cx - f * 3, cy + 4, spec.bloomHalo);
}

/**
 * Bonebloom — domed cranium, eye sockets, nose gap, teeth + chin (−y = up).
 * BloomShape id: `"Bonebloom"`.
 */
function paintShapeSkull(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  void rnd;
  if (mini) {
    for (const [dx, dy, c] of [
      [0, -3, spec.bloomHalo],
      [-1, -2, spec.bloom],
      [0, -2, spec.bloomCore],
      [1, -2, spec.bloom],
      [-2, -1, spec.bloomHalo],
      [-1, -1, spec.bloomHalo],
      [0, -1, spec.bloomCore],
      [1, -1, spec.bloomHalo],
      [2, -1, spec.bloomHalo],
      [-1, 0, spec.bloom],
      [0, 0, spec.bloomCore],
      [1, 0, spec.bloom],
      [-1, 1, spec.bloomHalo],
      [0, 1, spec.bloom],
      [1, 1, spec.bloomHalo],
      [0, 2, spec.bloomCore],
    ] as const) {
      paint(cx + dx, cy + dy, c);
    }
    return;
  }
  const h = spec.bloomHalo;
  const b = spec.bloom;
  const c = spec.bloomCore;
  const cells: [number, number, string][] = [
    [-1, -5, h],
    [0, -5, c],
    [1, -5, h],
    [-2, -4, h],
    [-1, -4, b],
    [0, -4, c],
    [1, -4, b],
    [2, -4, h],
    [-3, -3, h],
    [0, -3, c],
    [3, -3, h],
    [-3, -2, b],
    [0, -2, b],
    [3, -2, b],
    [-3, -1, b],
    [-1, -1, b],
    [1, -1, b],
    [3, -1, b],
    [-3, 0, b],
    [-2, 0, b],
    [-1, 0, c],
    [1, 0, c],
    [2, 0, b],
    [3, 0, b],
    [-2, 1, h],
    [-1, 1, b],
    [0, 1, c],
    [1, 1, b],
    [2, 1, h],
    [-1, 2, b],
    [0, 2, c],
    [1, 2, b],
    [0, 3, h],
  ];
  for (const [dx, dy, col] of cells) {
    paint(cx + dx, cy + dy, col);
  }
}

/**
 * Fourfold Root — four heart-ish lobes on N/E/S/W and a center knot.
 * BloomShape id: `"Fourfold Root"`.
 */
function paintShapeClover(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  void rnd;
  const h = spec.bloomHalo;
  const b = spec.bloom;
  const c = spec.bloomCore;
  if (mini) {
    paint(cx, cy, c);
    for (const [dx, dy, col] of [
      [0, -2, h],
      [-1, -1, b],
      [0, -1, b],
      [1, -1, b],
      [-2, 0, h],
      [-1, 0, b],
      [1, 0, b],
      [2, 0, h],
      [-1, 1, b],
      [0, 1, b],
      [1, 1, b],
      [0, 2, h],
    ] as const) {
      paint(cx + dx, cy + dy, col);
    }
    return;
  }
  paint(cx, cy, c);
  const cells: [number, number, string][] = [
    // North lobe (heart bump)
    [0, -5, h],
    [-1, -4, b],
    [0, -4, c],
    [1, -4, b],
    [-2, -3, h],
    [-1, -3, b],
    [0, -3, b],
    [1, -3, b],
    [2, -3, h],
    [-1, -2, b],
    [0, -2, b],
    [1, -2, b],
    // East lobe
    [5, 0, h],
    [4, -1, b],
    [4, 0, c],
    [4, 1, b],
    [3, -2, h],
    [3, -1, b],
    [3, 0, b],
    [3, 1, b],
    [3, 2, h],
    [2, -1, b],
    [2, 1, b],
    // South lobe
    [0, 5, h],
    [-1, 4, b],
    [0, 4, c],
    [1, 4, b],
    [-2, 3, h],
    [-1, 3, b],
    [0, 3, b],
    [1, 3, b],
    [2, 3, h],
    [-1, 2, b],
    [0, 2, b],
    [1, 2, b],
    // West lobe
    [-5, 0, h],
    [-4, -1, b],
    [-4, 0, c],
    [-4, 1, b],
    [-3, -2, h],
    [-3, -1, b],
    [-3, 0, b],
    [-3, 1, b],
    [-3, 2, h],
    [-2, -1, b],
    [-2, 1, b],
  ];
  for (const [dx, dy, col] of cells) {
    paint(cx + dx, cy + dy, col);
  }
}

/**
 * Witch Eye — roundish gaze: sclera ring, iris donut, pupil, catchlight (−y = up).
 * `BloomShape` id: `"Witch Eye"`.
 */
function paintShapeGlassGaze(paint: PaintFn, cx: number, cy: number, spec: Species, rnd: number[], mini: boolean) {
  const h = spec.bloomHalo;
  const s = spec.bloom;
  const p = spec.bloomCore;
  const iris = spec.bloom;
  const glint = spec.bloomHalo;
  const lx = rnd[4]! > 0.5 ? 1 : -1;
  const slit = rnd[8]! > 0.86;
  const lazyX = !slit && rnd[5]! > 0.68 ? 1 : !slit && rnd[5]! < 0.32 ? -1 : 0;

  if (mini) {
    paint(cx, cy - 2, h);
    paint(cx - 1, cy - 1, h);
    paint(cx, cy - 1, slit ? p : s);
    paint(cx + 1, cy - 1, h);
    if (slit) {
      paint(cx, cy, p);
      paint(cx - 1, cy, iris);
      paint(cx + 1, cy, iris);
    } else {
      paint(cx + lazyX - 1, cy, iris);
      paint(cx + lazyX, cy, p);
      paint(cx + lazyX + 1, cy, iris);
    }
    paint(cx - 1, cy + 1, s);
    paint(cx, cy + 1, h);
    paint(cx + 1, cy + 1, s);
    if (rnd[3]! > 0.48) paint(cx - 2, cy, h);
    if (rnd[7]! > 0.58) paint(cx + 2, cy - 1, h);
    paint(cx + lx, cy - 1, glint);
    return;
  }

  const smallOrb: [number, number, string][] = slit
    ? [
        [0, -3, h],
        [-1, -2, h],
        [0, -2, s],
        [1, -2, h],
        [-2, -1, h],
        [-1, -1, iris],
        [0, -1, p],
        [1, -1, iris],
        [2, -1, h],
        [-2, 0, s],
        [-1, 0, iris],
        [0, 0, p],
        [1, 0, iris],
        [2, 0, s],
        [-2, 1, h],
        [-1, 1, iris],
        [0, 1, iris],
        [1, 1, iris],
        [2, 1, h],
        [-1, 2, s],
        [0, 2, s],
        [1, 2, s],
        [0, 3, h],
      ]
    : [
        [0, -3, h],
        [-1, -2, h],
        [0, -2, s],
        [1, -2, h],
        [-2, -1, h],
        [-1, -1, iris],
        [0, -1, iris],
        [1, -1, iris],
        [2, -1, h],
        [-2, 0, s],
        [-1, 0, iris],
        [0, 0, iris],
        [1, 0, iris],
        [2, 0, s],
        [-2, 1, h],
        [-1, 1, iris],
        [0, 1, iris],
        [1, 1, iris],
        [2, 1, h],
        [-1, 2, s],
        [0, 2, s],
        [1, 2, s],
        [0, 3, h],
      ];

  for (const [dx, dy, col] of smallOrb) {
    paint(cx + dx, cy + dy, col);
  }
  if (!slit) {
    paint(cx + lazyX, cy, p);
  }

  if (rnd[2]! > 0.52) paint(cx - 3, cy - 1, h);
  if (rnd[2]! > 0.38) paint(cx - 3, cy, h);
  if (rnd[7]! > 0.48) paint(cx + 3, cy, h);
  if (rnd[7]! > 0.62) paint(cx + 2, cy + 2, h);
  if (rnd[3]! > 0.68) paint(cx - 1, cy + 3, h);
  if (rnd[6]! > 0.72) paint(cx + 1, cy - 4, h);
  if (rnd[1]! > 0.8) paint(cx - 2, cy + 2, p);

  paint(cx + lx, cy - 2, glint);
}

/** Overwrites cells so the stem tip becomes a visible flower (tryPaint skips occupied). */
function paintBloomCluster(
  cx: number,
  cy: number,
  spec: Species,
  cols: number,
  rows: number,
  rnd: number[],
  occupied: Map<string, string>,
  shape: BloomShape,
  kind: BloomKind,
) {
  const paint = (x: number, y: number, color: string) => {
    if (x < 0 || x >= cols || y < 0 || y >= rows) return;
    occupied.set(cellKey(x, y), color);
  };

  const mini = kind === "mini";

  switch (shape) {
    case "Stelix":
      paintShapeSpike(paint, cx, cy, spec, rnd, mini);
      break;
    case "Orbith":
      paintShapeDisk(paint, cx, cy, spec, rnd, mini);
      break;
    case "Dew Goblet":
      paintShapeBell(paint, cx, cy, spec, rnd, mini);
      break;
    case "Quadron":
      paintShapeCross(paint, cx, cy, spec, rnd, mini);
      break;
    case "Painwheel":
      paintShapeStar(paint, cx, cy, spec, rnd, mini);
      break;
    case "Mourning Fan":
      paintShapeFan(paint, cx, cy, spec, rnd, mini);
      break;
    case "Sperion":
      paintShapeSpray(paint, cx, cy, spec, rnd, mini);
      break;
    case "Duonis":
      paintShapeTwin(paint, cx, cy, spec, rnd, mini);
      break;
    case "Fear Lily":
      paintShapeLily(paint, cx, cy, spec, rnd, mini);
      break;
    case "Grave Tears":
      paintShapePendant(paint, cx, cy, spec, rnd, mini);
      break;
    case "Thorn Tiara":
      paintShapeCrown(paint, cx, cy, spec, rnd, mini);
      break;
    case "Bolide":
      paintShapeComet(paint, cx, cy, spec, rnd, mini);
      break;
    case "Bloodsop":
      paintShapePompom(paint, cx, cy, spec, rnd, mini);
      break;
    case "Soft Fang":
      paintShapeOrchid(paint, cx, cy, spec, rnd, mini);
      break;
    case "Rethel":
      paintShapeUmbel(paint, cx, cy, spec, rnd, mini);
      break;
    case "Zygoth":
      paintShapeZigzag(paint, cx, cy, spec, rnd, mini);
      break;
    case "Sweet Curse":
      paintShapeHeart(paint, cx, cy, spec, rnd, mini);
      break;
    case "Falcith":
      paintShapeCrescent(paint, cx, cy, spec, rnd, mini);
      break;
    case "Mirror Lotus":
      paintShapeLotus(paint, cx, cy, spec, rnd, mini);
      break;
    case "Glowmoth":
      paintShapeBiolume(paint, cx, cy, spec, rnd, mini);
      break;
    case "Witch Eye":
      paintShapeGlassGaze(paint, cx, cy, spec, rnd, mini);
      break;
    case "Obelon":
      paintShapeVeil(paint, cx, cy, spec, rnd, mini);
      break;
    case "Trikon":
      paintShapeTriskel(paint, cx, cy, spec, rnd, mini);
      break;
    case "Ghost Petal":
      paintShapeSakura(paint, cx, cy, spec, rnd, mini);
      break;
    case "Prunith":
      paintShapeUme(paint, cx, cy, spec, rnd, mini);
      break;
    case "Vortalis":
      paintShapeKiku(paint, cx, cy, spec, rnd, mini);
      break;
    case "Racemor":
      paintShapeFuji(paint, cx, cy, spec, rnd, mini);
      break;
    case "Blade Lily":
      paintShapeIris(paint, cx, cy, spec, rnd, mini);
      break;
    case "Bonebloom":
      paintShapeSkull(paint, cx, cy, spec, rnd, mini);
      break;
    case "Fourfold Root":
      paintShapeClover(paint, cx, cy, spec, rnd, mini);
      break;
    case "Nodion":
      paintShapeNod(paint, cx, cy, spec, rnd, mini);
      break;
    case "Serpic":
      paintShapeLilt(paint, cx, cy, spec, rnd, mini);
      break;
    case "Sorrow Weep":
      paintShapeWeep(paint, cx, cy, spec, rnd, mini);
      break;
    default:
      paintShapeDisk(paint, cx, cy, spec, rnd, mini);
  }
}

/** Stable `rnd` for catalog / Storybook so pixels are reproducible. */
export const VIGIL_BOOT_FLOWER_CATALOG_RND: readonly number[] = [
  0.52, 0.48, 0.51, 0.49, 0.53, 0.47, 0.5, 0.52, 0.48, 0.5,
];

export type VigilBootBloomKind = "full" | "mini";

/**
 * Renders one boot bloom into a cell grid (for catalogs). Uses `paintBloomCluster` + fixed `rnd`.
 */
export function getVigilBootBloomOccupied(
  shape: BloomShape,
  speciesIndex: number,
  tileCols: number,
  tileRows: number,
  cx: number,
  cy: number,
  kind: VigilBootBloomKind = "full",
): Map<string, string> {
  const spec = SPECIES[speciesIndex];
  if (!spec) return new Map();
  const m = new Map<string, string>();
  const rnd = [...VIGIL_BOOT_FLOWER_CATALOG_RND];
  paintBloomCluster(cx, cy, spec, tileCols, tileRows, rnd, m, shape, kind);
  return m;
}

export function drawVigilBootOccupiedOnCanvas(
  ctx: CanvasRenderingContext2D,
  occupied: Map<string, string>,
  cssW: number,
  cssH: number,
): void {
  occupied.forEach((color, k) => {
    const comma = k.indexOf(",");
    if (comma < 1) return;
    const x = Number(k.slice(0, comma));
    const y = Number(k.slice(comma + 1));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    drawCell(ctx, x, y, color, cssW, cssH);
  });
}

type VigilBootFlowerGardenProps = {
  active: boolean;
};

export const VigilBootFlowerGarden = forwardRef<VigilBootFlowerGardenHandle, VigilBootFlowerGardenProps>(
  function VigilBootFlowerGarden({ active }, ref) {
    const filterId = useId().replace(/:/g, "");

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const occupiedRef = useRef<Map<string, string>>(new Map());
    const witheringRef = useRef<Map<string, WitherCell>>(new Map());
    const frameRef = useRef(0);
    const rafRef = useRef<number>(0);
    const cssSizeRef = useRef({ w: 0, h: 0 });
    const reducedMotionRef = useRef(false);
    const gardenRngRef = useRef<GardenRng>({ s: 0x6a09e667 });
    const bloomShapeOrderRef = useRef<BloomShape[]>([...BLOOM_SHAPES]);

    const resize = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      cssSizeRef.current = { w, h };
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      particlesRef.current = [];
      occupiedRef.current = new Map();
      witheringRef.current = new Map();
    }, []);

    useLayoutEffect(() => {
      gardenRandBump(gardenRngRef.current);
    }, []);

    useLayoutEffect(() => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      const u = () => {
        reducedMotionRef.current = mq.matches;
      };
      u();
      mq.addEventListener("change", u);
      return () => mq.removeEventListener("change", u);
    }, []);

    useEffect(() => {
      if (typeof document === "undefined") return;
      const root = document.documentElement;
      const onThemeMutation = () => invalidateVigilBootFlowerAccentCache();
      const observer = new MutationObserver(onThemeMutation);
      observer.observe(root, {
        attributes: true,
        attributeFilter: ["class", "style", "data-theme"],
      });
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      resize();
      const onResize = () => resize();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, [resize]);

    const cutAt = useCallback(
      (clientX: number, clientY: number) => {
        if (!active) return;
        const { w, h } = cssSizeRef.current;
        if (w < 1 || h < 1) return;
        const gx = Math.floor(clientX / PIXEL);
        const gy = Math.floor(clientY / PIXEL);
        if (gx < 0 || gy < 0 || gx * PIXEL >= w || gy * PIXEL >= h) return;

        const occupied = occupiedRef.current;
        const seed = findNearestOccupied(gx, gy, occupied, 40);
        if (!seed) return;

        const [sx, sy] = seed;
        const queue: [number, number][] = [[sx, sy]];
        const visited = new Set<string>();
        const keys: string[] = [];

        /* Full 8-connected component; mark empties visited so the queue stays sane. */
        while (queue.length > 0) {
          const [x, y] = queue.shift()!;
          const k = cellKey(x, y);
          if (visited.has(k)) continue;
          visited.add(k);
          if (!occupied.has(k)) continue;
          keys.push(k);
          for (const [dx, dy] of NEIGHBOR8) {
            queue.push([x + dx, y + dy]);
          }
        }

        const cutKeys = expandOccupiedWithinChebyshevHaloOfCore(
          keys,
          occupied,
          CUT_HALO_CHEBYSHEV,
        );
        const cutSet = new Set(cutKeys);
        particlesRef.current = particlesRef.current.filter(
          (p) => !particleTouchesExpandedCut(p.x, p.y, cutSet, PARTICLE_CULL_MARGIN),
        );

        if (reducedMotionRef.current) {
          const withering = witheringRef.current;
          for (const k of cutKeys) {
            withering.delete(k);
            occupied.delete(k);
          }
          return;
        }

        const withering = witheringRef.current;
        const startMs = performance.now();
        let bi = 0;
        for (const k of cutKeys) {
          if (withering.has(k)) continue;
          const from = occupied.get(k);
          if (!from) continue;
          const { r, g, b } = sampleCssColorToRgb(from);
          const dead = hexToRgb(DEAD_CELL_COLORS[bi++ % DEAD_CELL_COLORS.length]!);
          withering.set(k, {
            r0: r,
            g0: g,
            b0: b,
            r1: dead.r,
            g1: dead.g,
            b1: dead.b,
            startMs,
            durationMs: WITHER_MS,
          });
        }
      },
      [active],
    );

    const clearAll = useCallback(() => {
      particlesRef.current = [];
      occupiedRef.current = new Map();
      witheringRef.current = new Map();
      const rng = gardenRngRef.current;
      gardenRandBump(rng);
      shuffleBloomShapeOrderMutable(bloomShapeOrderRef.current, rng);
    }, []);

    const spawnAt = useCallback((clientX: number, clientY: number) => {
      if (!active || reducedMotionRef.current) return;
      const { w, h } = cssSizeRef.current;
      if (w < 1 || h < 1) return;
      const gx = Math.floor(clientX / PIXEL);
      const gy = Math.floor(clientY / PIXEL);
      if (gx < 0 || gy < 0 || gx * PIXEL >= w || gy * PIXEL >= h) return;

      const rng = gardenRngRef.current;
      const species = rollBootFlowerSpeciesIndex(rng);
      const spec = SPECIES[species]!;
      const rnd = Array.from({ length: 10 }, () => gardenRandU01(rng));
      const energy = Math.floor(spec.energyMin + rnd[0]! * (spec.energyMax - spec.energyMin));
      const shapeOrder = bloomShapeOrderRef.current;
      const shapeRoll = (rnd[2]! + rnd[8]!) * 0.5;
      const bloomShape =
        shapeOrder[Math.min(shapeOrder.length - 1, Math.floor(shapeRoll * shapeOrder.length))]!;
      const vineLeafy = gardenRandU01(rng) < VINE_LEAFY_CHANCE;
      const vineThorny = gardenRandU01(rng) < VINE_THORNY_CHANCE;

      if (particlesRef.current.length >= MAX_PARTICLES) {
        particlesRef.current.splice(0, Math.ceil(MAX_PARTICLES * 0.15));
      }

      const occupied = occupiedRef.current;
      const k0 = cellKey(gx, gy);
      if (!occupied.has(k0)) {
        occupied.set(k0, spec.stem);
      }

      particlesRef.current.push({
        x: gx,
        y: gy,
        energy,
        species,
        rnd,
        age: 0,
        dir: rnd[1]! > 0.5 ? 1 : -1,
        bloomShape,
        vineLeafy,
        vineThorny,
      });
    }, [active]);

    useImperativeHandle(ref, () => ({ spawnAt, cutAt, clearAll }), [spawnAt, cutAt, clearAll]);

    useEffect(() => {
      if (!active) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const tick = () => {
        rafRef.current = requestAnimationFrame(tick);
        const { w, h } = cssSizeRef.current;
        if (w < 1 || h < 1) return;

        frameRef.current += 1;
        if (frameRef.current % TICK_EVERY === 0) {
          const cols = Math.ceil(w / PIXEL);
          const rows = Math.ceil(h / PIXEL);
          const occupied = occupiedRef.current;
          let next: Particle[] = [];

          const tryPaint = (x: number, y: number, color: string) => {
            const k = cellKey(x, y);
            if (occupied.has(k)) return false;
            occupied.set(k, color);
            return true;
          };

          for (const p of particlesRef.current) {
            const spec = SPECIES[p.species]!;
            p.age += 1;
            p.energy -= 1;

            const r = p.rnd[p.age % 10]!;
            const r2 = p.rnd[(p.age + 3) % 10]!;
            const r3 = p.rnd[(p.age + 6) % 10]!;

            if (p.energy <= 0) {
              paintBloomCluster(p.x, p.y, spec, cols, rows, p.rnd, occupied, p.bloomShape, "full");
              if (r > 0.4) {
                const outerLeaves = [
                  [0, -3],
                  [0, 3],
                  [3, 0],
                  [-3, 0],
                  [2, -2],
                  [-2, -2],
                  [2, 2],
                  [-2, 2],
                ] as const;
                for (const [dx, dy] of outerLeaves) {
                  const nx = p.x + dx;
                  const ny = p.y + dy;
                  if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && p.rnd[(dx + dy + 9) % 10]! > 0.5) {
                    tryPaint(nx, ny, spec.leaf);
                  }
                }
              }
              if (spec.spike && r2 > 0.65) {
                const sx = p.x + (r3 > 0.5 ? 2 : -2);
                const sy = p.y + (p.rnd[4]! > 0.5 ? 1 : 0);
                if (sx >= 0 && sx < cols && sy >= 0 && sy < rows) {
                  occupied.set(cellKey(sx, sy), spec.spike);
                }
              }
              continue;
            }

            const sinW = Math.sin(p.age * spec.sinFreq) * spec.sinAmp;
            let lateral = Math.round((r - 0.5) * spec.wander + sinW);
            if (p.rnd[(p.age + 7) % 10]! < GROWTH_GUST_LEFT_LATERAL) lateral -= 1;
            const run = p.age % 5 === 0 && r2 < spec.lateralRun ? p.dir * Math.round(r3 * 2) : 0;
            let nx = p.x + lateral + run;
            let r2Up = r2;
            if (p.rnd[(p.age + 8) % 10]! < GROWTH_GUST_UP_CHANCE) {
              r2Up = Math.max(0, r2 - GROWTH_GUST_UP_R2_SHIFT);
            }
            let ny = p.y - 1 + Math.round((r2Up - 0.5) * spec.upJitter);

            nx = Math.max(0, Math.min(cols - 1, nx));
            ny = Math.max(0, Math.min(rows - 1, ny));

            let moved = false;
            if (!occupied.has(cellKey(nx, ny))) {
              tryPaint(nx, ny, spec.stem);
              paintRareStemDecor(spec, nx, ny, p, tryPaint);
              p.x = nx;
              p.y = ny;
              next.push(p);
              moved = true;
            } else {
              const leftFirst = p.rnd[(p.age + 4) % 10]! < GROWTH_COLLIDE_LEFT_FIRST;
              const alts = leftFirst
                ? ([
                    [p.x - p.dir, p.y - 1],
                    [p.x + p.dir, p.y - 1],
                    [p.x + lateral, p.y],
                    [p.x, p.y - 2],
                  ] as const)
                : ([
                    [p.x + p.dir, p.y - 1],
                    [p.x - p.dir, p.y - 1],
                    [p.x + lateral, p.y],
                    [p.x, p.y - 2],
                  ] as const);
              for (const [ax, ay] of alts) {
                if (ax < 0 || ax >= cols || ay < 0 || ay >= rows) continue;
                if (!occupied.has(cellKey(ax, ay))) {
                  tryPaint(ax, ay, spec.stem);
                  paintRareStemDecor(spec, ax, ay, p, tryPaint);
                  p.x = ax;
                  p.y = ay;
                  next.push(p);
                  moved = true;
                  break;
                }
              }
            }

            if (!moved) {
              paintBloomCluster(p.x, p.y, spec, cols, rows, p.rnd, occupied, p.bloomShape, "mini");
            }

            if (
              moved &&
              p.energy >= spec.branchEnergyMin &&
              r3 > spec.branchGate &&
              next.length < MAX_PARTICLES
            ) {
              const childEnergy = Math.max(6, Math.floor(p.energy * spec.branchEnergyFrac));
              const branchRnd = p.rnd.map((v, i) =>
                i === (p.age % 10) ? gardenRandU01(gardenRngRef.current) : v,
              );
              next.push({
                x: p.x,
                y: p.y,
                energy: childEnergy,
                species: p.species,
                rnd: branchRnd,
                age: 0,
                dir: -p.dir,
                bloomShape: p.bloomShape,
                vineLeafy: p.vineLeafy,
                vineThorny: p.vineThorny,
              });
            }
          }

          if (next.length > MAX_PARTICLES) {
            next = next.slice(-MAX_PARTICLES);
          }
          particlesRef.current = next;
        }

        const tSec = performance.now() / 1000;
        const nowMs = performance.now();
        flushGardenCanvas(
          ctx,
          w,
          h,
          occupiedRef.current,
          witheringRef.current,
          nowMs,
          tSec,
          !reducedMotionRef.current,
        );
      };

      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    }, [active]);

    return (
      <div className={styles.wrap} aria-hidden>
        <svg className={styles.svgDefs} aria-hidden focusable="false">
          <defs>
            <filter
              id={filterId}
              x="-14%"
              y="-10%"
              width="128%"
              height="120%"
              colorInterpolationFilters="sRGB"
            >
              <feOffset in="SourceGraphic" dx="1.58" dy="0" result="ro" />
              <feColorMatrix
                in="ro"
                type="matrix"
                values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
                result="r"
              />
              <feOffset in="SourceGraphic" dx="-1.52" dy="0" result="bo" />
              <feColorMatrix
                in="bo"
                type="matrix"
                values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
                result="b"
              />
              <feMerge>
                <feMergeNode in="r" />
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>
        <div
          className={styles.fxStack}
          style={{
            filter: `url(#${filterId}) contrast(1.08) saturate(1.15) brightness(1.03)`,
          }}
        >
          <canvas ref={canvasRef} className={styles.canvas} />
        </div>
      </div>
    );
  },
);
