import { describe, expect, it } from "vitest";

import { embedTexts, isEmbeddingApiConfigured } from "@/src/lib/embedding-provider";

describe("embedding-provider", () => {
  it("isEmbeddingApiConfigured is false (no embedding API wired)", () => {
    expect(isEmbeddingApiConfigured()).toBe(false);
  });

  it("embedTexts throws when no provider is configured", async () => {
    await expect(embedTexts(["a"])).rejects.toThrow(/not configured/i);
  });

  it("embedTexts returns empty for empty input", async () => {
    await expect(embedTexts([])).resolves.toEqual([]);
  });
});
