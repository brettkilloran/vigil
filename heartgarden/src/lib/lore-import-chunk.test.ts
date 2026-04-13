import { describe, expect, it } from "vitest";

import { chunkSourceText } from "@/src/lib/lore-import-chunk";

describe("chunkSourceText", () => {
  it("splits on markdown headings", () => {
    const text = "# One\nalpha\n\n## Two\nbeta";
    const chunks = chunkSourceText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((c) => c.body.includes("alpha"))).toBe(true);
    expect(chunks.some((c) => c.body.includes("beta"))).toBe(true);
  });

  it("returns empty for empty string", () => {
    expect(chunkSourceText("")).toEqual([]);
  });
});
