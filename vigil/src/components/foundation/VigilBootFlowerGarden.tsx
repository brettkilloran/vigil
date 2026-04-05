"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

import styles from "./VigilBootFlowerGarden.module.css";

const PIXEL = 5;
const PIXEL_PAD = 0.5;
const MAX_PARTICLES = 420;
const TICK_EVERY = 2;

export type VigilBootFlowerGardenHandle = {
  spawnAt: (clientX: number, clientY: number) => void;
};

type Species = {
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

const SPECIES: Species[] = [
  {
    stem: "#1e3224",
    leaf: "#355a3c",
    bloom: "#5d7df5",
    bloomCore: "#9eb6ff",
    bloomHalo: "#3d52c4",
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
    stem: "#243520",
    leaf: "#3d5234",
    bloom: "#d94db7",
    bloomCore: "#ff8fe0",
    bloomHalo: "#a8328f",
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
    spike: "#4a4a4a",
  },
  {
    stem: "#1a281c",
    leaf: "#2f4a32",
    bloom: "#3b59ff",
    bloomCore: "#7a9cff",
    bloomHalo: "#2a3eb8",
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
    stem: "#2a3818",
    leaf: "#4a6230",
    bloom: "#f7e41e",
    bloomCore: "#fff6a0",
    bloomHalo: "#c4b318",
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
    stem: "#1c2e28",
    leaf: "#356050",
    bloom: "#7fc8ff",
    bloomCore: "#c5e8ff",
    bloomHalo: "#4a9fd4",
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
    stem: "#2a3218",
    leaf: "#485a30",
    bloom: "#fff9ae",
    bloomCore: "#fffce8",
    bloomHalo: "#d4ce7a",
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
    stem: "#1e2430",
    leaf: "#3a4558",
    bloom: "#9d68d4",
    bloomCore: "#d4a8ff",
    bloomHalo: "#6b4299",
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
    spike: "#555555",
  },
];

type Particle = {
  x: number;
  y: number;
  energy: number;
  species: number;
  rnd: number[];
  age: number;
  dir: number;
};

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
  ctx.fillStyle = color;
  ctx.fillRect(px, py, sz, sz);
}

type BloomKind = "full" | "mini";

/** Overwrites cells so the stem tip becomes a visible flower (tryPaint skips occupied). */
function paintBloomCluster(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spec: Species,
  cols: number,
  rows: number,
  rnd: number[],
  occupied: Map<string, string>,
  w: number,
  h: number,
  kind: BloomKind,
) {
  const paint = (x: number, y: number, color: string) => {
    if (x < 0 || x >= cols || y < 0 || y >= rows) return;
    occupied.set(cellKey(x, y), color);
    drawCell(ctx, x, y, color, w, h);
  };

  if (kind === "mini") {
    paint(cx, cy, spec.bloomCore);
    paint(cx, cy - 1, spec.bloom);
    paint(cx, cy + 1, spec.bloom);
    paint(cx - 1, cy, spec.bloom);
    paint(cx + 1, cy, spec.bloom);
    const r0 = rnd[0]!;
    if (r0 > 0.38) paint(cx - 1, cy - 1, spec.bloomHalo);
    if (r0 > 0.52) paint(cx + 1, cy - 1, spec.bloomHalo);
    if (r0 > 0.48) paint(cx - 1, cy + 1, spec.bloomHalo);
    if (r0 > 0.58) paint(cx + 1, cy + 1, spec.bloomHalo);
    return;
  }

  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const cheb = Math.max(Math.abs(dx), Math.abs(dy));
      if (cheb > 2) continue;
      if (cheb === 2) {
        const gate = rnd[Math.abs(dx * 3 + dy * 5) % 10]!;
        if (gate < 0.28) continue;
      }
      const x = cx + dx;
      const y = cy + dy;
      const manh = Math.abs(dx) + Math.abs(dy);
      let color: string;
      if (cheb === 0) color = spec.bloomCore;
      else if (cheb === 1) color = spec.bloom;
      else color = manh >= 4 ? spec.bloomHalo : spec.bloom;
      if (cheb === 2 && rnd[(dx + 7) % 10]! > 0.62) color = spec.bloom;
      paint(x, y, color);
    }
  }
}

type VigilBootFlowerGardenProps = {
  active: boolean;
};

export const VigilBootFlowerGarden = forwardRef<VigilBootFlowerGardenHandle, VigilBootFlowerGardenProps>(
  function VigilBootFlowerGarden({ active }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const occupiedRef = useRef<Map<string, string>>(new Map());
    const frameRef = useRef(0);
    const rafRef = useRef<number>(0);
    const cssSizeRef = useRef({ w: 0, h: 0 });
    const reducedMotionRef = useRef(false);

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
    }, []);

    useEffect(() => {
      reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }, []);

    useEffect(() => {
      resize();
      const onResize = () => resize();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, [resize]);

    const spawnAt = useCallback((clientX: number, clientY: number) => {
      if (!active || reducedMotionRef.current) return;
      const { w, h } = cssSizeRef.current;
      if (w < 1 || h < 1) return;
      const gx = Math.floor(clientX / PIXEL);
      const gy = Math.floor(clientY / PIXEL);
      if (gx < 0 || gy < 0 || gx * PIXEL >= w || gy * PIXEL >= h) return;

      const species = Math.floor(Math.random() * SPECIES.length);
      const spec = SPECIES[species]!;
      const rnd = Array.from({ length: 10 }, () => Math.random());
      const energy = Math.floor(spec.energyMin + rnd[0]! * (spec.energyMax - spec.energyMin));

      if (particlesRef.current.length >= MAX_PARTICLES) {
        particlesRef.current.splice(0, Math.ceil(MAX_PARTICLES * 0.15));
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const occupied = occupiedRef.current;
      const k0 = cellKey(gx, gy);
      if (!occupied.has(k0)) {
        occupied.set(k0, spec.stem);
        if (ctx) drawCell(ctx, gx, gy, spec.stem, w, h);
      }

      particlesRef.current.push({
        x: gx,
        y: gy,
        energy,
        species,
        rnd,
        age: 0,
        dir: rnd[1]! > 0.5 ? 1 : -1,
      });
    }, [active]);

    useImperativeHandle(ref, () => ({ spawnAt }), [spawnAt]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const tick = () => {
        rafRef.current = requestAnimationFrame(tick);
        if (!active || reducedMotionRef.current) return;

        frameRef.current += 1;
        if (frameRef.current % TICK_EVERY !== 0) return;

        const { w, h } = cssSizeRef.current;
        const cols = Math.ceil(w / PIXEL);
        const rows = Math.ceil(h / PIXEL);
        const occupied = occupiedRef.current;
        let next: Particle[] = [];

        const tryPaint = (x: number, y: number, color: string) => {
          const k = cellKey(x, y);
          if (occupied.has(k)) return false;
          occupied.set(k, color);
          drawCell(ctx, x, y, color, w, h);
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
            paintBloomCluster(ctx, p.x, p.y, spec, cols, rows, p.rnd, occupied, w, h, "full");
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
                drawCell(ctx, sx, sy, spec.spike, w, h);
              }
            }
            continue;
          }

          const sinW = Math.sin(p.age * spec.sinFreq) * spec.sinAmp;
          const lateral = Math.round((r - 0.5) * spec.wander + sinW);
          const run = p.age % 5 === 0 && r2 < spec.lateralRun ? p.dir * Math.round(r3 * 2) : 0;
          let nx = p.x + lateral + run;
          let ny = p.y - 1 + Math.round((r2 - 0.5) * spec.upJitter);

          const clamped = () => {
            nx = Math.max(0, Math.min(cols - 1, nx));
            ny = Math.max(0, Math.min(rows - 1, ny));
          };
          clamped();

          let moved = false;
          if (!occupied.has(cellKey(nx, ny))) {
            tryPaint(nx, ny, spec.stem);
            p.x = nx;
            p.y = ny;
            next.push(p);
            moved = true;
          } else {
            const alts = [
              [p.x + p.dir, p.y - 1],
              [p.x - p.dir, p.y - 1],
              [p.x + lateral, p.y],
              [p.x, p.y - 2],
            ] as const;
            for (const [ax, ay] of alts) {
              if (ax < 0 || ax >= cols || ay < 0 || ay >= rows) continue;
              if (!occupied.has(cellKey(ax, ay))) {
                tryPaint(ax, ay, spec.stem);
                p.x = ax;
                p.y = ay;
                next.push(p);
                moved = true;
                break;
              }
            }
          }

          if (!moved) {
            paintBloomCluster(ctx, p.x, p.y, spec, cols, rows, p.rnd, occupied, w, h, "mini");
          }

          if (
            moved &&
            p.energy >= spec.branchEnergyMin &&
            r3 > spec.branchGate &&
            next.length < MAX_PARTICLES
          ) {
            const childEnergy = Math.max(6, Math.floor(p.energy * spec.branchEnergyFrac));
            const branchRnd = p.rnd.map((v, i) => (i === (p.age % 10) ? Math.random() : v));
            next.push({
              x: p.x,
              y: p.y,
              energy: childEnergy,
              species: p.species,
              rnd: branchRnd,
              age: 0,
              dir: -p.dir,
            });
          }
        }

        if (next.length > MAX_PARTICLES) {
          next = next.slice(-MAX_PARTICLES);
        }
        particlesRef.current = next;
      };

      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    }, [active]);

    return (
      <div className={styles.wrap} aria-hidden>
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
    );
  },
);
