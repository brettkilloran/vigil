import { describe, expect, it } from "vitest";

import {
  IMPORT_CARD_GAP,
  IMPORT_CARD_HEIGHT,
  IMPORT_CARD_WIDTH,
  placeImportCards,
} from "@/src/lib/lore-import-placement";

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

describe("placeImportCards", () => {
  it("places solo entities without overlap", () => {
    const result = placeImportCards({
      entities: [
        { affinities: [], clientId: "a" },
        { affinities: [], clientId: "b" },
        { affinities: [], clientId: "c" },
      ],
      originX: 0,
      originY: 0,
    });
    const rects = Object.values(result.entities);
    expect(rects).toHaveLength(3);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(overlaps(rects[i]!, rects[j]!)).toBe(false);
      }
    }
  });

  it("keeps source card at origin and entities below it", () => {
    const result = placeImportCards({
      entities: [{ affinities: [], clientId: "a" }],
      originX: 10,
      originY: 20,
      source: { height: 360, width: 420 },
    });
    expect(result.source?.x).toBe(10);
    expect(result.source?.y).toBe(20);
    const rect = result.entities.a!;
    expect(rect.y).toBeGreaterThanOrEqual(
      result.source?.y + result.source?.height
    );
  });

  it("clusters affine entities near each other", () => {
    const result = placeImportCards({
      entities: [
        // Three highly connected around "hub"
        { affinities: ["a", "b", "c"], clientId: "hub" },
        { affinities: ["hub"], clientId: "a" },
        { affinities: ["hub"], clientId: "b" },
        { affinities: ["hub"], clientId: "c" },
        // Disconnected outsider
        { affinities: [], clientId: "outsider" },
      ],
      originX: 0,
      originY: 0,
    });
    const step = IMPORT_CARD_WIDTH + IMPORT_CARD_GAP;
    const hub = result.entities.hub!;
    const a = result.entities.a!;
    const b = result.entities.b!;
    const c = result.entities.c!;
    const hubAffineDistance = (r: typeof hub) =>
      Math.hypot(r.x - hub.x, r.y - hub.y);
    for (const r of [a, b, c]) {
      expect(hubAffineDistance(r)).toBeLessThan(step * 3.1);
    }
  });

  it("avoids obstacle rects", () => {
    const result = placeImportCards({
      entities: [{ affinities: [], clientId: "a" }],
      obstacles: [
        { height: IMPORT_CARD_HEIGHT, width: IMPORT_CARD_WIDTH, x: 0, y: 0 },
      ],
      originX: 0,
      originY: 0,
    });
    const rect = result.entities.a!;
    expect(rect.x !== 0 || rect.y !== 0).toBe(true);
  });

  it("is deterministic for the same input", () => {
    const input = {
      entities: [
        { affinities: ["b"], clientId: "a" },
        { affinities: ["a"], clientId: "b" },
        { affinities: [], clientId: "c" },
      ],
      originX: 0,
      originY: 0,
    };
    const a = placeImportCards(input);
    const b = placeImportCards(input);
    expect(a).toEqual(b);
  });

  it("no two placed cards overlap even in crowded scenes", () => {
    const entities = Array.from({ length: 18 }, (_, i) => ({
      affinities: i % 3 === 0 ? [`n${(i + 1) % 18}`, `n${(i + 2) % 18}`] : [],
      clientId: `n${i}`,
    }));
    const result = placeImportCards({
      entities,
      originX: 0,
      originY: 0,
      source: { height: 360, width: 420 },
    });
    const rects = Object.values(result.entities);
    expect(rects).toHaveLength(18);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(overlaps(rects[i]!, rects[j]!)).toBe(false);
      }
      if (result.source) {
        expect(overlaps(rects[i]!, result.source)).toBe(false);
      }
    }
  });
});
