import { describe, expect, it } from "vitest";

import { buildLoreMetaAnthropicBody, computeLoreMetaSourceHash } from "@/src/lib/item-vault-index";

describe("lore meta anthropic body + hash", () => {
  it("builds title + body like reindexItemVault", () => {
    expect(
      buildLoreMetaAnthropicBody({
        title: "  A  ",
        contentText: "hello",
      }),
    ).toBe("Title: A\n\nhello");
  });

  it("title-only and empty content", () => {
    expect(
      buildLoreMetaAnthropicBody({
        title: "T",
        contentText: "",
      }),
    ).toBe("Title: T");
  });

  it("computeLoreMetaSourceHash is stable for same inputs", () => {
    const row = { title: "x", contentText: "y" };
    expect(computeLoreMetaSourceHash(row)).toBe(computeLoreMetaSourceHash(row));
  });

  it("computeLoreMetaSourceHash golden hex for fixed row (skip-hash compatibility)", () => {
    const row = { title: "x", contentText: "y" };
    expect(computeLoreMetaSourceHash(row)).toBe(
      "bf63d6d9ad40477112a80b68119b96a19573fc32963e0f4c469ae4d6e6d74dd4",
    );
  });

  it("long content beyond cap hashes truncated body only", () => {
    const pad = "a".repeat(25_000);
    const row = { title: "t", contentText: pad };
    const h1 = computeLoreMetaSourceHash(row);
    const rowSamePrefix = { title: "t", contentText: pad + "TAIL" };
    const h2 = computeLoreMetaSourceHash(rowSamePrefix);
    expect(h1).toBe(h2);
  });
});
