import { describe, expect, it } from "vitest";

import { EMPTY_HG_DOC } from "@/src/lib/hg-doc/constants";
import { buildItemVaultCorpus } from "@/src/lib/item-searchable-text";

describe("buildItemVaultCorpus", () => {
  it("includes hgDoc prose and hgArch string leaves", () => {
    const c = buildItemVaultCorpus({
      contentJson: {
        doc: {
          content: [
            {
              content: [{ text: "Doc line", type: "text" }],
              type: "paragraph",
            },
          ],
          type: "doc",
        },
        format: "hgDoc",
        hgArch: { orgNamePrimary: "The Syndicate" },
      },
      contentText: "plain",
      title: "T",
    });
    expect(c).toContain("Doc line");
    expect(c).toContain("The Syndicate");
    expect(c).toContain("plain");
    expect(c).toContain("T");
  });

  it("strips format html fragments", () => {
    const c = buildItemVaultCorpus({
      contentJson: {
        format: "html",
        html: "<p>Alpha</p><script>x</script>",
      },
      contentText: "",
      title: "",
    });
    expect(c).toContain("Alpha");
    expect(c).not.toContain("script");
  });

  it("emits a kind:<canonicalEntityKind> token for imported items", () => {
    const c = buildItemVaultCorpus({
      contentJson: null,
      contentText: "",
      entityMeta: { canonicalEntityKind: "npc", import: true },
      title: "Varin",
    });
    expect(c).toContain("kind:npc");
  });

  it("does not emit kind: for malformed canonicalEntityKind", () => {
    const c = buildItemVaultCorpus({
      contentJson: null,
      contentText: "",
      entityMeta: { canonicalEntityKind: "NPC-! ! space" },
      title: "Weird",
    });
    expect(c).not.toContain("kind:");
  });

  it("includes entity_meta strings", () => {
    const c = buildItemVaultCorpus({
      contentText: "",
      entityMeta: { customTag: "north-quarter", note: "GM only" },
      title: "x",
    });
    expect(c).toContain("north-quarter");
    expect(c).toContain("GM only");
  });

  it("handles empty hgDoc", () => {
    const c = buildItemVaultCorpus({
      contentJson: { doc: EMPTY_HG_DOC, format: "hgDoc" },
      contentText: "",
      title: "",
    });
    expect(c).toBe("");
  });
});
