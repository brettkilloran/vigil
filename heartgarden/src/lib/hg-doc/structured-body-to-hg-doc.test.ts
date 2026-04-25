import { describe, expect, it } from "vitest";

import { STRUCTURED_BODY_EVAL_FIXTURES } from "@/src/lib/hg-doc/structured-body-eval-fixtures";
import {
  markdownToStructuredBody,
  structuredBodyToHgDoc,
} from "@/src/lib/hg-doc/structured-body-to-hg-doc";

describe("structuredBodyToHgDoc", () => {
  it("emits expected block node kinds", () => {
    const body = {
      blocks: [
        { kind: "heading", level: 1, text: "Doc" },
        { kind: "paragraph", text: "Body text" },
        { items: ["A", "B"], kind: "bullet_list" },
        { items: ["C"], kind: "ordered_list" },
        { kind: "quote", text: "Quote text" },
        { kind: "hr" },
      ],
    } as const;
    const built = structuredBodyToHgDoc(body);
    const topTypes = (built.doc.content ?? []).map((n) => n.type);
    expect(topTypes).toContain("heading");
    expect(topTypes).toContain("paragraph");
    expect(topTypes).toContain("bulletList");
    expect(topTypes).toContain("orderedList");
    expect(topTypes).toContain("blockquote");
    expect(topTypes).toContain("horizontalRule");
  });

  it("auto-prepends H1 when required", () => {
    const built = structuredBodyToHgDoc(
      { blocks: [{ kind: "paragraph", text: "Body only" }] },
      { requireH1: true, title: "Canonical Title" }
    );
    const first = built.doc.content?.[0];
    expect(first?.type).toBe("heading");
    expect(String(first?.content?.[0]?.text ?? "")).toContain(
      "Canonical Title"
    );
    expect(built.structureReport.autoPrependedH1).toBe(true);
  });

  it("parses markdown lists/headings into blocks", () => {
    const parsed = markdownToStructuredBody(
      "# Top\n\n## Sub\n\n- one\n- two\n\n> quote"
    );
    expect(
      parsed.blocks.some((b) => b.kind === "heading" && b.level === 1)
    ).toBe(true);
    expect(
      parsed.blocks.some((b) => b.kind === "heading" && b.level === 2)
    ).toBe(true);
    expect(parsed.blocks.some((b) => b.kind === "bullet_list")).toBe(true);
    expect(parsed.blocks.some((b) => b.kind === "quote")).toBe(true);
  });

  it("passes eval fixtures and heading count expectations", () => {
    for (const fixture of STRUCTURED_BODY_EVAL_FIXTURES) {
      const built = structuredBodyToHgDoc(fixture.input, {
        requireH1: true,
        title: fixture.title,
      });
      expect(built.structureReport.finalHeadingCount.h1).toBeGreaterThanOrEqual(
        fixture.expect.minH1
      );
      expect(built.structureReport.finalHeadingCount.h2).toBeGreaterThanOrEqual(
        fixture.expect.minH2
      );
      expect(built.structureReport.finalHeadingCount.h3).toBeGreaterThanOrEqual(
        fixture.expect.minH3
      );
    }
  });
});
