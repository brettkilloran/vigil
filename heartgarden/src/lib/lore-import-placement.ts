/**
 * Proximity-driven placement for freshly imported cards.
 *
 * The old two-column grid (`planLoreImportCardLayout`) packed every card into
 * a rigid stack regardless of how they relate. That made dense imports visually
 * homogenous and forced the user to untangle relationships by hand after apply.
 *
 * This module picks card positions by affinity:
 *   1. Rank entities by connection degree; most-connected first.
 *   2. Place the anchor at `originX/originY`.
 *   3. For each subsequent entity, compute the centroid of its already-placed
 *      affines and snap to the nearest empty grid cell via a spiral ring search.
 *   4. Fall back to a column layout for unconnected leftovers.
 *
 * Obstacles (existing canvas rows the apply path pre-reserves) are treated as
 * occupied cells so imports don't overdraw user-placed work.
 *
 * @see docs/LORE_IMPORT_AUDIT_2026-04-21.md §4.9 and plan §8.
 */
export const IMPORT_CARD_WIDTH = 280;
export const IMPORT_CARD_HEIGHT = 260;
export const IMPORT_CARD_GAP = 28;

export interface ImportPlacementRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface PlaceImportCardsInput {
  entities: {
    clientId: string;
    width?: number;
    height?: number;
    /** Other entity clientIds this card is related to (affinity weight = 1 each). */
    affinities: string[];
  }[];
  /** Existing occupied rects to avoid. */
  obstacles?: ImportPlacementRect[];
  originX: number;
  originY: number;
  /** Source (imported document) card — placed first so it can anchor affines. */
  source?: { width: number; height: number } | null;
}

export interface PlaceImportCardsOutput {
  entities: Record<string, ImportPlacementRect>;
  source?: ImportPlacementRect;
}

interface Cell {
  col: number;
  row: number;
}

function cellKey(c: Cell): string {
  return `${c.col},${c.row}`;
}

/** Convert a canvas point to the nearest grid cell relative to an origin. */
function pointToCell(
  x: number,
  y: number,
  origin: { x: number; y: number }
): Cell {
  const step = IMPORT_CARD_WIDTH + IMPORT_CARD_GAP;
  return {
    col: Math.round((x - origin.x) / step),
    row: Math.round((y - origin.y) / step),
  };
}

function cellToRect(
  c: Cell,
  origin: { x: number; y: number },
  width: number,
  height: number
): ImportPlacementRect {
  const stepX = IMPORT_CARD_WIDTH + IMPORT_CARD_GAP;
  const stepY = IMPORT_CARD_HEIGHT + IMPORT_CARD_GAP;
  return {
    height,
    width,
    x: origin.x + c.col * stepX,
    y: origin.y + c.row * stepY,
  };
}

/** Ring-1 spiral: yields cells ordered by Chebyshev distance from `center`. */
function* spiralCells(center: Cell, maxRadius: number): IterableIterator<Cell> {
  yield center;
  for (let r = 1; r <= maxRadius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      yield { col: center.col + dx, row: center.row - r };
      yield { col: center.col + dx, row: center.row + r };
    }
    for (let dy = -r + 1; dy <= r - 1; dy++) {
      yield { col: center.col - r, row: center.row + dy };
      yield { col: center.col + r, row: center.row + dy };
    }
  }
}

/**
 * Place imported cards around the anchor, respecting existing obstacles and
 * affinity between entities. Deterministic: same input ⇒ same output.
 */
export function placeImportCards(
  input: PlaceImportCardsInput
): PlaceImportCardsOutput {
  const origin = { x: input.originX, y: input.originY };
  const occupied = new Set<string>();

  // Mark obstacle cells as occupied.
  for (const o of input.obstacles ?? []) {
    const cell = pointToCell(o.x, o.y, origin);
    occupied.add(cellKey(cell));
  }

  // Anchor: source card if present, else (0,0) grid cell.
  let sourceRect: ImportPlacementRect | undefined;
  let anchorCell: Cell = { col: 0, row: 0 };
  if (input.source) {
    sourceRect = {
      height: input.source.height,
      width: input.source.width,
      x: origin.x,
      y: origin.y,
    };
    // Reserve the source's footprint cells so entities don't land on top.
    const stepX = IMPORT_CARD_WIDTH + IMPORT_CARD_GAP;
    const stepY = IMPORT_CARD_HEIGHT + IMPORT_CARD_GAP;
    const colsWide = Math.max(1, Math.ceil(input.source.width / stepX));
    const rowsTall = Math.max(1, Math.ceil(input.source.height / stepY));
    for (let c = 0; c < colsWide; c++) {
      for (let r = 0; r < rowsTall; r++) {
        occupied.add(cellKey({ col: c, row: r }));
      }
    }
    anchorCell = { col: 0, row: rowsTall };
  } else {
    occupied.add(cellKey(anchorCell));
  }

  // Sort entities: highest degree first; break ties by input order.
  const degree = new Map<string, number>();
  for (const e of input.entities) {
    degree.set(e.clientId, e.affinities.length);
  }
  const ordered = [...input.entities].sort((a, b) => {
    const d = (degree.get(b.clientId) ?? 0) - (degree.get(a.clientId) ?? 0);
    if (d !== 0) {
      return d;
    }
    return input.entities.indexOf(a) - input.entities.indexOf(b);
  });

  const placements: Record<string, ImportPlacementRect> = {};
  const placedCells = new Map<string, Cell>();
  const maxRadius =
    Math.ceil(Math.sqrt(Math.max(1, input.entities.length))) + 6;

  for (const entity of ordered) {
    const w = entity.width ?? IMPORT_CARD_WIDTH;
    const h = entity.height ?? IMPORT_CARD_HEIGHT;

    // Ideal center: centroid of already-placed affinities, else the anchor.
    const placedAffineCells = entity.affinities
      .map((id) => placedCells.get(id))
      .filter((c): c is Cell => c != null);
    let ideal: Cell;
    if (placedAffineCells.length > 0) {
      const avgCol =
        placedAffineCells.reduce((s, c) => s + c.col, 0) /
        placedAffineCells.length;
      const avgRow =
        placedAffineCells.reduce((s, c) => s + c.row, 0) /
        placedAffineCells.length;
      ideal = { col: Math.round(avgCol), row: Math.round(avgRow) + 1 };
    } else {
      ideal = anchorCell;
    }

    let picked: Cell | null = null;
    for (const cell of spiralCells(ideal, maxRadius)) {
      if (!occupied.has(cellKey(cell))) {
        picked = cell;
        break;
      }
    }
    if (!picked) {
      // Fallback — should never hit unless maxRadius is tiny.
      picked = { col: 0, row: ordered.indexOf(entity) + 2 };
    }

    occupied.add(cellKey(picked));
    placedCells.set(entity.clientId, picked);
    placements[entity.clientId] = cellToRect(picked, origin, w, h);
  }

  return {
    entities: placements,
    source: sourceRect,
  };
}

/**
 * Backwards-compatible shim for call sites that still receive a count-only layout plan.
 * Returns source + ordered entity rects in input order without any affinity data.
 */
export function placeImportCardsCountOnly(
  originX: number,
  originY: number,
  hasSource: boolean,
  entityCount: number
): {
  source?: ImportPlacementRect;
  entities: ImportPlacementRect[];
} {
  const entities = Array.from({ length: entityCount }, (_, i) => ({
    affinities: [],
    clientId: `__e${i}`,
  }));
  const result = placeImportCards({
    entities,
    originX,
    originY,
    source: hasSource ? { height: 360, width: 420 } : undefined,
  });
  return {
    entities: entities.map((e) => result.entities[e.clientId]!),
    source: result.source,
  };
}
