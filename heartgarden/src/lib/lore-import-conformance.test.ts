import { describe, expect, it } from "vitest";

import { planLoreImportCardLayout } from "@/src/lib/lore-import-commit";

describe("lore import layout conformance", () => {
  it("places distinct grid positions for multiple entities (no identical coords)", () => {
    const layout = planLoreImportCardLayout(100, 200, false, 4);
    expect(layout.entities).toHaveLength(4);
    const keys = new Set(layout.entities.map((e) => `${e.x},${e.y}`));
    expect(keys.size).toBe(4);
  });

  it("offsets entity grid below source card when source present", () => {
    const withSource = planLoreImportCardLayout(0, 0, true, 2);
    expect(withSource.source).toBeDefined();
    const sy = withSource.source!.y + withSource.source!.height + 28;
    expect(withSource.entities[0]!.y).toBeGreaterThanOrEqual(sy);
  });
});
