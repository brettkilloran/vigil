import { describe, expect, it } from "vitest";

import {
  fuseRrfFromOrderedLists,
  RRF_K,
  rrfScore,
} from "@/src/lib/vault-retrieval-rrf";

describe("rrfScore", () => {
  it("is zero when rank is undefined", () => {
    expect(rrfScore(undefined)).toBe(0);
  });

  it("decreases with rank", () => {
    expect(rrfScore(0)).toBeGreaterThan(rrfScore(5));
    expect(rrfScore(0)).toBeCloseTo(1 / (RRF_K + 1), 8);
  });
});

describe("fuseRrfFromOrderedLists", () => {
  it("prefers ids strong in both lists", () => {
    const lexical = ["c", "d", "b"];
    const vector = ["b", "a"];
    const { topIds, scores } = fuseRrfFromOrderedLists({
      lexicalOrderedIds: lexical,
      maxItems: 10,
      vectorOrderedIds: vector,
    });
    expect(topIds[0]).toBe("b");
    expect(scores.get("b")?.lexRank).toBe(2);
    expect(scores.get("b")?.vecRank).toBe(0);
  });

  it("surfaces vector-only id", () => {
    const { topIds } = fuseRrfFromOrderedLists({
      lexicalOrderedIds: ["x"],
      maxItems: 5,
      vectorOrderedIds: ["y", "x"],
    });
    expect(topIds).toContain("y");
    expect(topIds).toContain("x");
  });

  it("respects maxItems", () => {
    const lexical = ["a", "b", "c", "d", "e"];
    const { topIds } = fuseRrfFromOrderedLists({
      lexicalOrderedIds: lexical,
      maxItems: 2,
      vectorOrderedIds: [],
    });
    expect(topIds).toEqual(["a", "b"]);
  });

  it("supports weighted fusion favoring lexical rank", () => {
    const out = fuseRrfFromOrderedLists({
      config: { lexicalWeight: 3, vectorWeight: 0.5 },
      lexicalOrderedIds: ["a", "b", "c"],
      maxItems: 3,
      vectorOrderedIds: ["c", "b", "a"],
    });
    expect(out.topIds[0]).toBe("a");
  });

  it("supports custom k via config", () => {
    const defaultScore = fuseRrfFromOrderedLists({
      lexicalOrderedIds: ["a", "b"],
      maxItems: 2,
      vectorOrderedIds: ["b", "a"],
    }).scores.get("a")?.rrf;
    const sharperScore = fuseRrfFromOrderedLists({
      config: { k: 1 },
      lexicalOrderedIds: ["a", "b"],
      maxItems: 2,
      vectorOrderedIds: ["b", "a"],
    }).scores.get("a")?.rrf;
    expect(defaultScore).toBeDefined();
    expect(sharperScore).toBeDefined();
    expect(sharperScore!).toBeGreaterThan(defaultScore!);
  });
});
