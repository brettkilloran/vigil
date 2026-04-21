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
});
