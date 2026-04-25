import { describe, expect, it } from "vitest";

import { EMPTY_HG_DOC } from "@/src/lib/hg-doc/constants";
import { hgDocToPlainText } from "@/src/lib/hg-doc/serialize";

describe("hgDocToPlainText", () => {
  it("extracts text from paragraphs and headings", () => {
    const doc = {
      content: [
        {
          attrs: { level: 1 },
          content: [{ text: "Hello", type: "text" }],
          type: "heading",
        },
        {
          content: [{ text: "world", type: "text" }],
          type: "paragraph",
        },
      ],
      type: "doc",
    };
    expect(hgDocToPlainText(doc)).toBe("Hello world");
  });

  it("returns empty for empty doc", () => {
    expect(hgDocToPlainText(EMPTY_HG_DOC).length).toBe(0);
  });
});
