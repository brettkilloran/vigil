import { describe, expect, it } from "vitest";
import {
  DEMO_FACTION_ROSTER,
  FACTION_ROSTER_HG_ARCH_KEY,
  parseFactionRoster,
  parseFactionRosterFromHgArch,
  factionRosterSchema,
} from "./faction-roster-schema";

describe("factionRosterSchema", () => {
  it("accepts DEMO_FACTION_ROSTER", () => {
    expect(factionRosterSchema.safeParse(DEMO_FACTION_ROSTER).success).toBe(true);
  });

  it("rejects duplicate kinds typo (unlinked without label)", () => {
    const bad = [{ id: "11111111-1111-4111-8111-111111111111", kind: "unlinked" }];
    expect(parseFactionRoster(bad)).toBeNull();
  });

  it("parseFactionRosterFromHgArch reads hgArch key", () => {
    const roster = parseFactionRosterFromHgArch({
      loreCard: { kind: "faction", variant: "v4" },
      [FACTION_ROSTER_HG_ARCH_KEY]: DEMO_FACTION_ROSTER,
    });
    expect(roster).toEqual(DEMO_FACTION_ROSTER);
  });

  it("returns null for missing or invalid hgArch", () => {
    expect(parseFactionRosterFromHgArch(null)).toBeNull();
    expect(parseFactionRosterFromHgArch({})).toBeNull();
    expect(parseFactionRosterFromHgArch({ [FACTION_ROSTER_HG_ARCH_KEY]: [{}] })).toBeNull();
  });
});
