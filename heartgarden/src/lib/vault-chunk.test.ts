import { describe, expect, it } from "vitest";

import {
  buildVaultEmbedDocument,
  chunkVaultSections,
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
    expect(c[0]).toContain("Untitled");
    expect(c[0]).toContain("Hello");
  });

  it("splits very long single paragraphs", () => {
    const word = "word ";
    const t = word.repeat(600).trim();
    const c = chunkVaultText(t);
    expect(c.length).toBeGreaterThan(1);
    const maxAllowed =
      VAULT_CHUNK_TARGET_CHARS + VAULT_CHUNK_OVERLAP_CHARS + 120;
    for (const ch of c) {
      expect(ch.length).toBeLessThanOrEqual(maxAllowed);
    }
  });
});

describe("chunkVaultSections", () => {
  it("keeps overlap inside section boundaries", () => {
    const chunks = chunkVaultSections([
      {
        charRange: [0, 1800],
        headingPath: ["Doc", "Section A"],
        text: "A ".repeat(900),
      },
      {
        charRange: [1801, 1810],
        headingPath: ["Doc", "Section B"],
        text: "B summary",
      },
    ]);
    expect(chunks.length).toBeGreaterThan(1);
    const sectionB = chunks.find((c) => c.breadcrumb.includes("Section B"));
    expect(sectionB?.chunkText).toContain("Section B");
    expect(sectionB?.chunkText).not.toContain("A A A A");
  });
});

describe("buildVaultEmbedDocument", () => {
  it("includes title summary and aliases", () => {
    const d = buildVaultEmbedDocument({
      contentText: "Body text.",
      loreAliases: ["the turncoat", "Rivers"],
      loreSummary: "A captain.",
      title: "Kellan",
    });
    expect(d).toContain("Title: Kellan");
    expect(d).toContain("Summary:");
    expect(d).toContain("Aliases:");
    expect(d).toContain("Body text.");
  });
});
