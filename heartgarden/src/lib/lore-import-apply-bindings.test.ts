import { describe, expect, it } from "vitest";

import {
  buildBindingPatchForImport,
  mergeHgArchBindingPatches,
} from "@/src/lib/lore-import-apply-bindings";

const TARGET_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

describe("buildBindingPatchForImport", () => {
  it("maps faction → character to a factionRoster stub", () => {
    const patch = buildBindingPatchForImport({
      sourceKind: "faction",
      targetItemId: TARGET_ID,
      targetKind: "npc",
      targetTitle: "Lyra",
    });
    expect(patch?.kind).toBe("faction.factionRoster");
    if (patch?.kind !== "faction.factionRoster") {
      throw new Error("bad kind");
    }
    expect(patch.entry.kind).toBe("character");
    if (patch.entry.kind !== "character") {
      throw new Error("bad entry kind");
    }
    expect(patch.entry.characterItemId).toBe(TARGET_ID);
    expect(patch.entry.displayNameOverride).toBe("Lyra");
  });

  it("maps character → faction to primaryFactions", () => {
    const patch = buildBindingPatchForImport({
      sourceKind: "character",
      targetItemId: TARGET_ID,
      targetKind: "faction",
    });
    expect(patch?.kind).toBe("character.primaryFactions");
  });

  it("maps character → location to primaryLocations", () => {
    const patch = buildBindingPatchForImport({
      sourceKind: "npc",
      targetItemId: TARGET_ID,
      targetKind: "location",
    });
    expect(patch?.kind).toBe("character.primaryLocations");
  });

  it("maps location → character to linkedCharacters", () => {
    const patch = buildBindingPatchForImport({
      sourceKind: "location",
      targetItemId: TARGET_ID,
      targetKind: "character",
    });
    expect(patch?.kind).toBe("location.linkedCharacters");
  });

  it("returns null for non-shell pairs (lore, quest, item)", () => {
    expect(
      buildBindingPatchForImport({
        sourceKind: "lore",
        targetItemId: TARGET_ID,
        targetKind: "lore",
      })
    ).toBeNull();
    expect(
      buildBindingPatchForImport({
        sourceKind: "quest",
        targetItemId: TARGET_ID,
        targetKind: "character",
      })
    ).toBeNull();
  });
});

describe("mergeHgArchBindingPatches", () => {
  it("appends a new faction roster entry without duplicating existing ones", () => {
    const base = {
      factionRoster: [
        {
          characterItemId: OTHER_ID,
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          kind: "character" as const,
        },
      ],
    };
    const { hgArch, touchedSlots } = mergeHgArchBindingPatches(base, [
      {
        entry: {
          characterItemId: TARGET_ID,
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          kind: "character",
        },
        kind: "faction.factionRoster",
      },
    ]);
    expect(Array.isArray(hgArch.factionRoster)).toBe(true);
    expect((hgArch.factionRoster as unknown[]).length).toBe(2);
    expect(touchedSlots).toContain("faction.factionRoster");
  });

  it("does not duplicate when the same character is already on the roster", () => {
    const base = {
      factionRoster: [
        {
          characterItemId: TARGET_ID,
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          kind: "character" as const,
        },
      ],
    };
    const { hgArch, touchedSlots } = mergeHgArchBindingPatches(base, [
      {
        entry: {
          characterItemId: TARGET_ID,
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          kind: "character",
        },
        kind: "faction.factionRoster",
      },
    ]);
    expect((hgArch.factionRoster as unknown[]).length).toBe(1);
    expect(touchedSlots).not.toContain("faction.factionRoster");
  });

  it("sets primaryFactionItemId / primaryLocationItemId on loreThreadAnchors", () => {
    const { hgArch, touchedSlots } = mergeHgArchBindingPatches(null, [
      { factionItemId: TARGET_ID, kind: "character.primaryFactions" },
      { kind: "character.primaryLocations", locationItemId: OTHER_ID },
    ]);
    const anchors = hgArch.loreThreadAnchors as Record<string, unknown>;
    expect(anchors.primaryFactionItemId).toBe(TARGET_ID);
    expect(anchors.primaryLocationItemId).toBe(OTHER_ID);
    expect(touchedSlots).toEqual(
      expect.arrayContaining([
        "character.primaryFactions",
        "character.primaryLocations",
      ])
    );
  });

  it("appends to linkedCharacterItemIds without duplicating", () => {
    const { hgArch } = mergeHgArchBindingPatches(
      {
        loreThreadAnchors: { linkedCharacterItemIds: [OTHER_ID] },
      },
      [
        { characterItemId: TARGET_ID, kind: "location.linkedCharacters" },
        { characterItemId: OTHER_ID, kind: "location.linkedCharacters" },
      ]
    );
    const anchors = hgArch.loreThreadAnchors as Record<string, unknown>;
    expect(anchors.linkedCharacterItemIds).toEqual([OTHER_ID, TARGET_ID]);
  });
});
