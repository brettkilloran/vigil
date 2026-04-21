import { describe, expect, it } from "vitest";

import { EMPTY_HG_DOC } from "@/src/lib/hg-doc/constants";
import { buildItemVaultCorpus } from "@/src/lib/item-searchable-text";

describe("buildItemVaultCorpus", () => {
  it("includes hgDoc prose and hgArch string leaves", () => {
    const c = buildItemVaultCorpus({
      title: "T",
      contentText: "plain",
      contentJson: {
        format: "hgDoc",
        doc: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Doc line" }] }],
        },
        hgArch: { orgNamePrimary: "The Syndicate" },
      },
    });
    expect(c).toContain("Doc line");
    expect(c).toContain("The Syndicate");
    expect(c).toContain("plain");
    expect(c).toContain("T");
  });

  it("strips format html fragments", () => {
    const c = buildItemVaultCorpus({
      title: "",
      contentText: "",
      contentJson: {
        format: "html",
        html: "<p>Alpha</p><script>x</script>",
      },
    });
    expect(c).toContain("Alpha");
    expect(c).not.toContain("script");
  });

  it("includes entity_meta strings", () => {
    const c = buildItemVaultCorpus({
      title: "x",
      contentText: "",
      entityMeta: { customTag: "north-quarter", note: "GM only" },
    });
    expect(c).toContain("north-quarter");
    expect(c).toContain("GM only");
  });

  it("handles empty hgDoc", () => {
    const c = buildItemVaultCorpus({
      title: "",
      contentText: "",
      contentJson: { format: "hgDoc", doc: EMPTY_HG_DOC },
    });
    expect(c).toBe("");
  });
});
