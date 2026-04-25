import { describe, expect, it } from "vitest";

import {
  groundedLoreAnswerContractIssue,
  type LoreSource,
  normalizeGroundedLoreAnswer,
} from "./lore-engine";

describe("normalizeGroundedLoreAnswer", () => {
  const sources: LoreSource[] = [
    {
      itemId: "11111111-1111-1111-1111-111111111111",
      title: "A",
      spaceId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      spaceName: "S",
      excerpt: "alpha",
    },
    {
      itemId: "22222222-2222-2222-2222-222222222222",
      title: "B",
      spaceId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      spaceName: "S",
      excerpt: "beta",
    },
  ];

  it("keeps only citations present in retrieved sources", () => {
    const out = normalizeGroundedLoreAnswer(
      {
        answer_text: "hello",
        cited_item_ids: [
          "11111111-1111-1111-1111-111111111111",
          "99999999-9999-9999-9999-999999999999",
          "11111111-1111-1111-1111-111111111111",
        ],
        insufficient_evidence: false,
      },
      sources
    );
    expect(out.answerText).toBe("hello");
    expect(out.citedItemIds).toEqual(["11111111-1111-1111-1111-111111111111"]);
    expect(out.insufficientEvidence).toBe(false);
  });

  it("returns safe defaults on malformed payload", () => {
    const out = normalizeGroundedLoreAnswer(null, sources);
    expect(out.answerText).toBe("");
    expect(out.citedItemIds).toEqual([]);
    expect(out.insufficientEvidence).toBe(false);
  });

  it("flags contract issue when answer text is empty", () => {
    const out = normalizeGroundedLoreAnswer(
      {
        answer_text: "   ",
        cited_item_ids: ["11111111-1111-1111-1111-111111111111"],
        insufficient_evidence: false,
      },
      sources
    );
    expect(groundedLoreAnswerContractIssue(out)).toBe("empty_answer_text");
  });

  it("flags contract issue when citations are missing without insufficiency", () => {
    const out = normalizeGroundedLoreAnswer(
      {
        answer_text: "Some answer",
        cited_item_ids: ["99999999-9999-9999-9999-999999999999"],
        insufficient_evidence: false,
      },
      sources
    );
    expect(groundedLoreAnswerContractIssue(out)).toBe("missing_citations");
  });

  it("allows citation-free output when insufficiency is true", () => {
    const out = normalizeGroundedLoreAnswer(
      {
        answer_text: "I cannot establish this from the provided evidence.",
        cited_item_ids: [],
        insufficient_evidence: true,
      },
      sources
    );
    expect(groundedLoreAnswerContractIssue(out)).toBeNull();
  });
});
