"use client";

import { useLayoutEffect, useRef } from "react";
import { ArchitecturalTooltip } from "@/src/components/foundation/ArchitecturalTooltip";
import styles from "./VigilBootFlowerCatalog.module.css";
import {
  BLOOM_SHAPES,
  type BloomShape,
  drawVigilBootOccupiedOnCanvas,
  getVigilBootBloomOccupied,
  SPECIES,
  VIGIL_BOOT_FLOWER_CELL_PX,
  VIGIL_BOOT_FLOWER_RARE_COUNT,
  VIGIL_BOOT_FLOWER_RARE_SPAWN_EACH,
  type VigilBootBloomKind,
} from "./VigilBootFlowerGarden";

const TILE_COLS = 26;
/** Taller tile + anchor higher so upward blooms aren’t clipped and bell/orchid “skirts” sit in-frame */
const TILE_ROWS = 26;
const CX = 13;
const CY = 14;

const CSS_W = TILE_COLS * VIGIL_BOOT_FLOWER_CELL_PX;
const CSS_H = TILE_ROWS * VIGIL_BOOT_FLOWER_CELL_PX;

const tileGridStyle = {
  display: "grid" as const,
  gridTemplateColumns: `repeat(${SPECIES.length}, ${CSS_W}px)`,
  gap: 8,
};

function BloomTile({
  shape,
  speciesIndex,
  varietyName,
  kind,
}: {
  shape: BloomShape;
  speciesIndex: number;
  varietyName: string;
  kind: VigilBootBloomKind;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    const dpr = Math.min(
      typeof window === "undefined" ? 1 : (window.devicePixelRatio ?? 1),
      2
    );
    canvas.width = Math.floor(CSS_W * dpr);
    canvas.height = Math.floor(CSS_H * dpr);
    canvas.style.width = `${CSS_W}px`;
    canvas.style.height = `${CSS_H}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CSS_W, CSS_H);
    const occ = getVigilBootBloomOccupied(
      shape,
      speciesIndex,
      TILE_COLS,
      TILE_ROWS,
      CX,
      CY,
      kind
    );
    drawVigilBootOccupiedOnCanvas(ctx, occ, CSS_W, CSS_H);
  }, [shape, speciesIndex, kind]);

  return (
    <ArchitecturalTooltip
      content={`#${speciesIndex} · ${varietyName}`}
      delayMs={200}
      side="top"
    >
      <div className={styles.tile}>
        <canvas aria-hidden className={styles.canvas} ref={ref} />
        <span className={styles.tileLabel}>{varietyName}</span>
      </div>
    </ArchitecturalTooltip>
  );
}

export interface VigilBootFlowerCatalogProps {
  kind?: VigilBootBloomKind;
}

/**
 * Storybook / dev catalog: every bloom shape × every species palette (full or mini cluster).
 */
export function VigilBootFlowerCatalog({
  kind = "full",
}: VigilBootFlowerCatalogProps) {
  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Boot flower catalog</h1>
      <p className={styles.intro}>
        Each row is one <strong>bloom shape</strong> ({BLOOM_SHAPES.length}{" "}
        total). Columns are <strong>color varieties</strong> by name (see
        legend). Fixed random seed so pixels match between runs. Bloom kind:{" "}
        <strong>{kind}</strong>. The last{" "}
        <strong>{VIGIL_BOOT_FLOWER_RARE_COUNT}</strong> columns (
        <strong>Spectrum</strong> &amp; <strong>Confetti</strong>) each have a{" "}
        <strong>{Math.round(VIGIL_BOOT_FLOWER_RARE_SPAWN_EACH * 100)}%</strong>{" "}
        spawn rate in the live garden; all other varieties split the remainder
        evenly.
      </p>

      <div className={styles.specLegend}>
        {SPECIES.map((spec, i) => (
          <div className={styles.specCard} key={i}>
            <ArchitecturalTooltip
              content={`Index ${i}`}
              delayMs={200}
              side="top"
            >
              <div className={styles.specLabel}>
                {spec.name}
                <span className={styles.specIndex}> #{i}</span>
              </div>
            </ArchitecturalTooltip>
            <div className={styles.swatches}>
              <ArchitecturalTooltip content="Stem" delayMs={200} side="top">
                <span
                  className={styles.swatch}
                  style={{ background: spec.stem }}
                />
              </ArchitecturalTooltip>
              <ArchitecturalTooltip content="Leaf" delayMs={200} side="top">
                <span
                  className={styles.swatch}
                  style={{ background: spec.leaf }}
                />
              </ArchitecturalTooltip>
              {spec.spike ? (
                <ArchitecturalTooltip content="Spike" delayMs={200} side="top">
                  <span
                    className={styles.swatch}
                    style={{ background: spec.spike }}
                  />
                </ArchitecturalTooltip>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.columnHead} style={tileGridStyle}>
        {SPECIES.map((spec, i) => (
          <ArchitecturalTooltip
            content={`#${i} · ${spec.name}`}
            delayMs={200}
            key={i}
            side="bottom"
          >
            <span className={styles.columnHeadCell}>
              <span className={styles.columnHeadName}>{spec.name}</span>
              <span className={styles.columnHeadIdx}>#{i}</span>
            </span>
          </ArchitecturalTooltip>
        ))}
      </div>

      {BLOOM_SHAPES.map((shape) => (
        <section className={styles.shapeRow} key={shape}>
          <h2 className={styles.shapeTitle}>{shape}</h2>
          <div className={styles.tiles} style={tileGridStyle}>
            {SPECIES.map((spec, speciesIndex) => (
              <BloomTile
                key={speciesIndex}
                kind={kind}
                shape={shape}
                speciesIndex={speciesIndex}
                varietyName={spec.name}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
