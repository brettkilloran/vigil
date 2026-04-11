import { describe, expect, it } from "vitest";

import { hgDocToHtml } from "@/src/lib/hg-doc/html-export";
import { hgDocToPlainText } from "@/src/lib/hg-doc/serialize";
import {
  htmlFragmentToHgDocDoc,
  legacyCodeBodyHtmlToHgDocSeed,
} from "@/src/lib/hg-doc/html-to-doc";

describe("html-to-doc", () => {
  it("htmlFragmentToHgDocDoc round-trips simple markup through hgDocToHtml", () => {
    const doc = htmlFragmentToHgDocDoc("<p>Hello <strong>world</strong></p>");
    expect(doc.type).toBe("doc");
    const html = hgDocToHtml(doc);
    expect(html).toContain("Hello");
    expect(html).toContain("world");
  });

  it("legacyCodeBodyHtmlToHgDocSeed strips tags into a paragraph", () => {
    const doc = legacyCodeBodyHtmlToHgDocSeed("<pre>// line</pre>");
    expect(doc.type).toBe("doc");
    const text = hgDocToHtml(doc);
    expect(text).toContain("// line");
  });

  it("htmlFragmentToHgDocDoc returns empty doc for blank input", () => {
    const d = htmlFragmentToHgDocDoc("   ");
    expect(d.type).toBe("doc");
    expect(hgDocToPlainText(d).trim()).toBe("");
  });
});
