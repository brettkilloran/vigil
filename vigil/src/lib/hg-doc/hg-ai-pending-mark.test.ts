import { describe, expect, it } from "vitest";

import { hgDocToHtml } from "@/src/lib/hg-doc/html-export";
import { htmlFragmentToHgDocDoc } from "@/src/lib/hg-doc/html-to-doc";
import {
  hgDocJsonHasHgAiPending,
  stripHgAiPendingFromHgDocJson,
  stripHgAiPendingFromHtml,
} from "@/src/lib/hg-doc/strip-hg-ai-pending";

describe("hgAiPending mark", () => {
  it("round-trips through HTML export and htmlFragmentToHgDocDoc", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Approved. " },
            {
              type: "text",
              text: "Pending AI line.",
              marks: [{ type: "hgAiPending" }],
            },
          ],
        },
      ],
    } as const;
    const html = hgDocToHtml(doc);
    expect(html).toContain("data-hg-ai-pending");
    const back = htmlFragmentToHgDocDoc(html);
    expect(hgDocJsonHasHgAiPending(back)).toBe(true);
  });

  it("stripHgAiPendingFromHgDocJson removes marks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x", marks: [{ type: "hgAiPending" }] }],
        },
      ],
    } as const;
    const stripped = stripHgAiPendingFromHgDocJson(doc);
    expect(hgDocJsonHasHgAiPending(stripped)).toBe(false);
    expect(stripped).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x" }],
        },
      ],
    });
  });

  it("stripHgAiPendingFromHtml unwraps spans emitted by hgDocToHtml", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Approved. " },
            {
              type: "text",
              text: "Pending AI line.",
              marks: [{ type: "hgAiPending" }],
            },
          ],
        },
      ],
    } as const;
    const html = hgDocToHtml(doc);
    const stripped = stripHgAiPendingFromHtml(html);
    expect(stripped).not.toMatch(/data-hg-ai-pending/);
    expect(stripped).toContain("Pending AI line.");
  });
});
