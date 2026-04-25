import { describe, expect, it } from "vitest";

import { hgDocToHtml } from "@/src/lib/hg-doc/html-export";
import {
  htmlFragmentToHgDocDoc,
  legacyCodeBodyHtmlToHgDocSeed,
  plainTextFromInlineHtmlFragment,
  stripLegacyHtmlToPlainText,
} from "@/src/lib/hg-doc/html-to-doc";
import { hgDocToPlainText } from "@/src/lib/hg-doc/serialize";

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

  it("stripLegacyHtmlToPlainText removes script and decodes entities", () => {
    const evil = "<script>alert(1)</script><p>a&nbsp;&amp;b</p>";
    expect(stripLegacyHtmlToPlainText(evil)).toBe("a &b");
  });

  it("plainTextFromInlineHtmlFragment inserts word boundary across <br> (not glued like textContent)", () => {
    expect(
      plainTextFromInlineHtmlFragment("ARBITER STATION<br />LAGRANGE 1")
    ).toBe("ARBITER STATION LAGRANGE 1");
  });

  it("legacyCodeBodyHtmlToHgDocSeed decodes nbsp and basic entities", () => {
    const doc = legacyCodeBodyHtmlToHgDocSeed(
      "<span>a</span>&nbsp;&nbsp;<span>b</span>"
    );
    const plain = hgDocToPlainText(doc);
    expect(plain).toMatch(/a\s+b/);
    expect(plain).not.toContain("&nbsp");

    const amp = legacyCodeBodyHtmlToHgDocSeed("<span>1 &lt; 2 &amp; 3</span>");
    expect(hgDocToPlainText(amp)).toContain("1 < 2 & 3");
  });

  it("htmlFragmentToHgDocDoc returns empty doc for blank input", () => {
    const d = htmlFragmentToHgDocDoc("   ");
    expect(d.type).toBe("doc");
    expect(hgDocToPlainText(d).trim()).toBe("");
  });
});
