import { describe, expect, it } from "vitest";

import {
  type LinkCharacterToFactionRosterRowResult,
  linkCharacterToFactionRosterRow,
} from "@/src/lib/faction-roster-link";
import type { FactionRosterEntry } from "@/src/lib/faction-roster-schema";

const charA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const charB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("linkCharacterToFactionRosterRow", () => {
  it("converts unlinked row to character and maps label/role", () => {
    const roster: FactionRosterEntry[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        kind: "unlinked",
        label: "Doc",
        role: "Medic",
      },
    ];
    const r = linkCharacterToFactionRosterRow(
      roster,
      "11111111-1111-4111-8111-111111111111",
      charA
    );
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.roster[0]).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      kind: "character",
      characterItemId: charA,
      displayNameOverride: "Doc",
      roleOverride: "Medic",
    });
  });

  it("no-op when already linked to same character", () => {
    const roster: FactionRosterEntry[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        kind: "character",
        characterItemId: charA,
      },
    ];
    const r = linkCharacterToFactionRosterRow(
      roster,
      "11111111-1111-4111-8111-111111111111",
      charA
    );
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.roster).toEqual(roster);
  });

  it("blocks replace by default when linked to different character", () => {
    const roster: FactionRosterEntry[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        kind: "character",
        characterItemId: charA,
      },
    ];
    const r = linkCharacterToFactionRosterRow(
      roster,
      "11111111-1111-4111-8111-111111111111",
      charB
    );
    expect(r.ok).toBe(false);
    if (r.ok) {
      return;
    }
    expect(r.code).toBe("replace_blocked");
  });

  it("allows replace when allowReplace is true", () => {
    const roster: FactionRosterEntry[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        kind: "character",
        characterItemId: charA,
        displayNameOverride: "Keep",
      },
    ];
    const r = linkCharacterToFactionRosterRow(
      roster,
      "11111111-1111-4111-8111-111111111111",
      charB,
      { allowReplace: true }
    );
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.roster[0]).toMatchObject({
      kind: "character",
      characterItemId: charB,
      displayNameOverride: "Keep",
    });
  });

  it("returns entry_not_found for unknown row id", () => {
    const roster: FactionRosterEntry[] = [];
    const r: LinkCharacterToFactionRosterRowResult =
      linkCharacterToFactionRosterRow(
        roster,
        "11111111-1111-4111-8111-111111111111",
        charA
      );
    expect(r.ok).toBe(false);
    if (r.ok) {
      return;
    }
    expect(r.code).toBe("entry_not_found");
  });
});
