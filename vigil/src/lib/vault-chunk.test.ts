import { describe, expect, it } from "vitest";

import {
  buildVaultEmbedDocument,
  chunkVaultText,
  VAULT_CHUNK_OVERLAP_CHARS,
  VAULT_CHUNK_TARGET_CHARS,
} from "@/src/lib/vault-chunk";

describe("chunkVaultText", () => {
  it("returns empty for blank input", () => {
    expect(chunkVaultText("")).toEqual([]);
    expect(chunkVaultText("   \n  ")).toEqual([]);
  });

  it("keeps short text in one chunk", () => {
    const t = "Hello world. Short note.";
    const c = chunkVaultText(t);
    expect(c.length).toBe(1);
    expect(c[0]).toContain("Hello");
  });

  it("splits very long single paragraphs", () => {
    const word = "word ";
    const t = word.repeat(600).trim();
    const c = chunkVaultText(t);
    expect(c.length).toBeGreaterThan(1);
    const maxAllowed = VAULT_CHUNK_TARGET_CHARS + VAULT_CHUNK_OVERLAP_CHARS + 120;
    for (const ch of c) {
      expect(ch.length).toBeLessThanOrEqual(maxAllowed);
    }
  });
});

describe("buildVaultEmbedDocument", () => {
  it("includes title summary and aliases", () => {
    const d = buildVaultEmbedDocument({
      title: "Kellan",
      contentText: "Body text.",
      loreSummary: "A captain.",
      loreAliases: ["the turncoat", "Rivers"],
    });
    expect(d).toContain("Title: Kellan");
    expect(d).toContain("Summary:");
    expect(d).toContain("Aliases:");
    expect(d).toContain("Body text.");
  });
});
