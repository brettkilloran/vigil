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

  it("segments heading-less prose into multiple semantic chunks", () => {
    const para = (i: number) =>
      `Paragraph ${i}: ` +
      "The obsidian shard hums through memory, witness notes, and contextual fallout. ".repeat(10);
    const text = Array.from({ length: 12 }, (_, i) => para(i + 1)).join("\n\n");
    const chunks = chunkSourceText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.body.length <= 2_000)).toBe(true);
    for (const c of chunks) {
      expect(c.charStart).toBeGreaterThanOrEqual(0);
      expect(c.charEnd).toBeGreaterThan(c.charStart);
    }
  });

  it("subdivides oversized heading sections at the 2k cap", () => {
    const huge = "# Incident\n" + "A".repeat(5_500);
    const chunks = chunkSourceText(huge);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((c) => c.body.length <= 2_000)).toBe(true);
    expect(chunks.some((c) => c.heading.includes("(part"))).toBe(true);
  });

  it("handles CRLF input without dropping content", () => {
    const text = "# One\r\nalpha\r\n\r\n## Two\r\nbeta\r\n\r\ngamma";
    const chunks = chunkSourceText(text);
    const joined = chunks.map((c) => c.body).join("\n");
    expect(joined).toContain("alpha");
    expect(joined).toContain("beta");
    expect(joined).toContain("gamma");
  });
});
