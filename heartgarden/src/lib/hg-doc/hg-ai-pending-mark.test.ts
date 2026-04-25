import { describe, expect, it } from "vitest";

import { collectHgAiPendingRangeMetrics } from "@/src/lib/hg-doc/collect-hg-ai-pending-ranges";
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
      content: [
        {
          content: [
            { text: "Approved. ", type: "text" },
            {
              marks: [{ type: "hgAiPending" }],
              text: "Pending AI line.",
              type: "text",
            },
          ],
          type: "paragraph",
        },
      ],
      type: "doc",
    } as const;
    const html = hgDocToHtml(doc);
    expect(html).toContain("data-hg-ai-pending");
    const back = htmlFragmentToHgDocDoc(html);
    expect(hgDocJsonHasHgAiPending(back)).toBe(true);
  });

  it("stripHgAiPendingFromHgDocJson removes marks", () => {
    const doc = {
      content: [
        {
          content: [
            { marks: [{ type: "hgAiPending" }], text: "x", type: "text" },
          ],
          type: "paragraph",
        },
      ],
      type: "doc",
    } as const;
    const stripped = stripHgAiPendingFromHgDocJson(doc);
    expect(hgDocJsonHasHgAiPending(stripped)).toBe(false);
    expect(stripped).toEqual({
      content: [
        {
          content: [{ text: "x", type: "text" }],
          type: "paragraph",
        },
      ],
      type: "doc",
    });
  });

  it("stripHgAiPendingFromHtml unwraps spans emitted by hgDocToHtml", () => {
    const doc = {
      content: [
        {
          content: [
            { text: "Approved. ", type: "text" },
            {
              marks: [{ type: "hgAiPending" }],
              text: "Pending AI line.",
              type: "text",
            },
          ],
          type: "paragraph",
        },
      ],
      type: "doc",
    } as const;
    const html = hgDocToHtml(doc);
    const stripped = stripHgAiPendingFromHtml(html);
    expect(stripped).not.toMatch(/data-hg-ai-pending/);
    expect(stripped).toContain("Pending AI line.");
  });

  it("collects pending coverage metrics for mostly-generated gating", () => {
    const markType = { name: "hgAiPending" };
    const editor = {
      schema: { marks: { hgAiPending: markType } },
      state: {
        doc: {
          descendants: (
            cb: (
              node: { isText: boolean; text?: string; marks: unknown[] },
              pos: number
            ) => void
          ) => {
            cb(
              {
                isText: true,
                marks: [{ type: markType }],
                text: "LLLLLLLLLLLLLLLLLLLL",
              },
              1
            );
            cb({ isText: true, marks: [], text: " tail" }, 21);
          },
        },
      },
    };
    const metrics = collectHgAiPendingRangeMetrics(editor as never);
    expect(metrics.ranges.length).toBeGreaterThan(0);
    expect(metrics.pendingChars).toBeGreaterThan(0);
    expect(metrics.totalTextChars).toBeGreaterThan(metrics.pendingChars);
    expect(metrics.pendingCoverage).toBeGreaterThan(0.75);
  });
});
