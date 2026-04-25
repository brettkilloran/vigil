import { describe, expect, it } from "vitest";

import {
  parseBool,
  parseCsv,
  parseSearchFiltersFromUrl,
} from "@/src/lib/heartgarden-search-url-params";

describe("parseBool", () => {
  it("parses true/false and returns undefined for other", () => {
    expect(parseBool(null)).toBeUndefined();
    expect(parseBool("")).toBeUndefined();
    expect(parseBool("true")).toBe(true);
    expect(parseBool("TRUE")).toBe(true);
    expect(parseBool("false")).toBe(false);
    expect(parseBool("maybe")).toBeUndefined();
  });
});

describe("parseCsv", () => {
  it("splits and trims", () => {
    expect(parseCsv(null)).toEqual([]);
    expect(parseCsv("a, b , c")).toEqual(["a", "b", "c"]);
  });
});

function stableFiltersSnapshot(
  f: ReturnType<typeof parseSearchFiltersFromUrl>
) {
  return {
    ...f,
    updatedAfter: f.updatedAfter?.toISOString(),
  };
}

describe("parseSearchFiltersFromUrl", () => {
  it('variant "full" matches legacy /api/search query shapes', () => {
    const u = new URL(
      "http://localhost/api/search?spaceId=s1&types=note,sticky&entityTypes=character&updatedAfter=2024-01-15T00:00:00.000Z&sort=updated&limit=10&hasLinks=true&inStack=false&minCampaignEpoch=3&excludeLoreHistorical=true"
    );
    expect(stableFiltersSnapshot(parseSearchFiltersFromUrl(u, "full"))).toEqual(
      {
        spaceId: "s1",
        itemTypes: ["note", "sticky"],
        entityTypes: ["character"],
        canonicalEntityKinds: [],
        updatedAfter: "2024-01-15T00:00:00.000Z",
        hasLinks: true,
        inStack: false,
        sort: "updated",
        limit: 10,
        minCampaignEpoch: 3,
        excludeLoreHistorical: true,
      }
    );
  });

  it('variant "full" parses canonicalKind CSV', () => {
    const u = new URL("http://localhost/api/search?canonicalKind=npc,faction");
    const f = parseSearchFiltersFromUrl(u, "full");
    expect(f.canonicalEntityKinds).toEqual(["npc", "faction"]);
  });

  it('variant "full" rejects invalid date and unknown sort', () => {
    const u = new URL(
      "http://localhost/api/search?updatedAfter=not-a-date&sort=badsort&minCampaignEpoch=nan"
    );
    const f = parseSearchFiltersFromUrl(u, "full");
    expect(f.updatedAfter).toBeUndefined();
    expect(f.sort).toBeUndefined();
    expect(f.minCampaignEpoch).toBeUndefined();
  });

  it('variant "suggest" matches legacy /api/search/suggest subset', () => {
    const u = new URL(
      "http://localhost/api/search/suggest?spaceId=sp&types=folder&limit=5&hasLinks=false"
    );
    expect(parseSearchFiltersFromUrl(u, "suggest")).toEqual({
      spaceId: "sp",
      itemTypes: ["folder"],
      entityTypes: [],
      canonicalEntityKinds: [],
      hasLinks: false,
      inStack: undefined,
      limit: 5,
    });
  });

  it('variant "chunks" matches legacy /api/search/chunks subset', () => {
    const u = new URL("http://localhost/api/search/chunks?spaceId=cx&limit=12");
    expect(parseSearchFiltersFromUrl(u, "chunks")).toEqual({
      spaceId: "cx",
      limit: 12,
    });
  });
});
