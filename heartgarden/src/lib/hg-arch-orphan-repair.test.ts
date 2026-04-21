import { describe, expect, it } from "vitest";

import { FACTION_ROSTER_HG_ARCH_KEY } from "@/src/lib/faction-roster-schema";
import { stripHgArchReferencesToItem } from "@/src/lib/hg-arch-orphan-repair";

const dead = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("stripHgArchReferencesToItem", () => {
  it("demotes roster row pointing at deleted character", () => {
    const cj = {
      hgArch: {
        [FACTION_ROSTER_HG_ARCH_KEY]: [
          { id: "11111111-1111-4111-8111-111111111111", kind: "character", characterItemId: dead },
        ],
      },
    };
    const next = stripHgArchReferencesToItem(cj, dead);
    expect(next).not.toBeNull();
    const roster = (next!.hgArch as Record<string, unknown>)[FACTION_ROSTER_HG_ARCH_KEY] as {
      kind: string;
    }[];
    expect(roster[0]!.kind).toBe("unlinked");
  });

  it("removes location anchor", () => {
    const cj = {
      hgArch: {
        loreThreadAnchors: { primaryLocationItemId: dead, primaryFactionItemId: other },
      },
    };
    const next = stripHgArchReferencesToItem(cj, dead);
    expect(next).not.toBeNull();
    const a = (next!.hgArch as { loreThreadAnchors?: { primaryLocationItemId?: string } })
      .loreThreadAnchors;
    expect(a?.primaryLocationItemId).toBeUndefined();
  });
});
