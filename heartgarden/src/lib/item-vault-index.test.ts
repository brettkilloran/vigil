import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildLoreMetaAnthropicBody, computeLoreMetaSourceHash } from "@/src/lib/item-vault-index";
import { LORE_META_MAX_INPUT_CHARS } from "@/src/lib/lore-item-meta";

const FIXED_MODEL = "claude-sonnet-4-20250514";
const FIXED_PROMPT_VERSION = "v1";

function expectedVersionedHash(body: string): string {
  return createHash("sha256")
    .update(`${FIXED_PROMPT_VERSION}|${FIXED_MODEL}|${body}`, "utf8")
    .digest("hex");
}

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
    expect(computeLoreMetaSourceHash(row, FIXED_MODEL)).toBe(
      computeLoreMetaSourceHash(row, FIXED_MODEL),
    );
  });

  it("computeLoreMetaSourceHash hex matches versioned envelope (prompt + model + body)", () => {
    // REVIEW_2026-04-25_1835 H8: the hash is now `sha256(promptVersion|model|body)`
    // so changing the prompt schema or the model name automatically invalidates
    // every stored `lore_meta_source_hash` and the next reindex refreshes meta.
    const row = { title: "x", contentText: "y" };
    expect(computeLoreMetaSourceHash(row, FIXED_MODEL)).toBe(
      expectedVersionedHash("Title: x\n\ny"),
    );
  });

  it("computeLoreMetaSourceHash differs across model names (model is part of envelope)", () => {
    const row = { title: "x", contentText: "y" };
    expect(computeLoreMetaSourceHash(row, FIXED_MODEL)).not.toBe(
      computeLoreMetaSourceHash(row, "claude-other-model"),
    );
  });

  it("long content beyond cap hashes truncated body only", () => {
    // `normalizeLoreMetaInputText` applies `LORE_META_MAX_INPUT_CHARS` to the full prompt;
    // content must exceed the cap so a trailing suffix is ignored for hashing.
    const pad = "a".repeat(LORE_META_MAX_INPUT_CHARS);
    const row = { title: "t", contentText: pad };
    const h1 = computeLoreMetaSourceHash(row, FIXED_MODEL);
    const rowSamePrefix = { title: "t", contentText: pad + "TAIL" };
    const h2 = computeLoreMetaSourceHash(rowSamePrefix, FIXED_MODEL);
    expect(h1).toBe(h2);
  });
});
