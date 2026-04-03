"use client";

import { useMemo } from "react";

import { extractVigilItemLinkTargets } from "@/src/lib/extract-vigil-item-links";
import type { CanvasItem } from "@/src/stores/canvas-types";

function linkEdgesFromItems(items: CanvasItem[]): { from: string; to: string }[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const edges: { from: string; to: string }[] = [];
  const seen = new Set<string>();

  for (const it of items) {
    if (it.itemType !== "note" && it.itemType !== "checklist") continue;
    const doc = it.contentJson;
    if (!doc) continue;
    const targets = extractVigilItemLinkTargets(doc);
    for (const tid of targets) {
      if (!byId.has(tid)) continue;
      const key = `${it.id}->${tid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: it.id, to: tid });
    }
  }
  return edges;
}

function cubicPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

export function ConnectionLines({ items }: { items: CanvasItem[] }) {
  const edges = useMemo(() => linkEdgesFromItems(items), [items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const bounds = useMemo(() => {
    let maxX = 4000;
    let maxY = 4000;
    for (const it of items) {
      maxX = Math.max(maxX, it.x + it.width + 200);
      maxY = Math.max(maxY, it.y + it.height + 200);
    }
    return { w: maxX, h: maxY };
  }, [items]);

  if (edges.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible"
      width={bounds.w}
      height={bounds.h}
      viewBox={`0 0 ${bounds.w} ${bounds.h}`}
      aria-hidden
    >
      {edges.map(({ from, to }) => {
        const a = byId.get(from);
        const b = byId.get(to);
        if (!a || !b) return null;
        const x1 = a.x + a.width;
        const y1 = a.y + a.height / 2;
        const x2 = b.x;
        const y2 = b.y + b.height / 2;
        return (
          <path
            key={`${from}-${to}`}
            d={cubicPath(x1, y1, x2, y2)}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={2}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
