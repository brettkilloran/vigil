import { describe, expect, it } from "vitest";

import {
  DEFAULT_FTS_LIMIT,
  DEFAULT_FUZZY_LIMIT_WHEN_EMPTY,
  DEFAULT_FUZZY_LIMIT_WHEN_SPARSE,
  DEFAULT_FTS_SPARSE_THRESHOLD,
} from "@/src/lib/vault-retrieval";
import { parseHybridRetrieveQueryParams } from "@/src/lib/vault-retrieval-query-params";

describe("parseHybridRetrieveQueryParams", () => {
  it("returns empty when no params", () => {
    expect(parseHybridRetrieveQueryParams(new URLSearchParams())).toEqual({});
  });

  it("clamps ftsLimit", () => {
    const p = parseHybridRetrieveQueryParams(new URLSearchParams({ ftsLimit: "999" }));
    expect(p.ftsLimit).toBe(200);
    const p2 = parseHybridRetrieveQueryParams(new URLSearchParams({ ftsLimit: "3" }));
    expect(p2.ftsLimit).toBe(8);
  });

  it("parses retrievalMaxItems", () => {
    const p = parseHybridRetrieveQueryParams(
      new URLSearchParams({ retrievalMaxItems: "40" }),
    );
    expect(p.maxItems).toBe(40);
  });
});

describe("defaults alignment with API_SEARCH profile", () => {
  it("matches historical hybrid defaults", async () => {
    const { API_SEARCH_HYBRID_OPTIONS } = await import("@/src/lib/vault-retrieval-profiles");
    expect(API_SEARCH_HYBRID_OPTIONS.ftsLimit).toBe(DEFAULT_FTS_LIMIT);
    expect(API_SEARCH_HYBRID_OPTIONS.fuzzyLimitWhenEmpty).toBe(DEFAULT_FUZZY_LIMIT_WHEN_EMPTY);
    expect(API_SEARCH_HYBRID_OPTIONS.fuzzyLimitWhenSparse).toBe(DEFAULT_FUZZY_LIMIT_WHEN_SPARSE);
    expect(API_SEARCH_HYBRID_OPTIONS.ftsSparseThreshold).toBe(DEFAULT_FTS_SPARSE_THRESHOLD);
  });
});
