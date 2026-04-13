import { describe, expect, it } from "vitest";

import {
  ALL_CANONICAL_KINDS,
  isLoreCardPersistedEntityType,
  loreShellKindFromCanonical,
  persistedEntityTypeFromCanonical,
} from "@/src/lib/lore-object-registry";

describe("lore-object-registry", () => {
  it("maps npc to character for persistence", () => {
    expect(persistedEntityTypeFromCanonical("npc")).toBe("character");
    expect(loreShellKindFromCanonical("npc")).toBe("character");
  });

  it("passes faction and location through", () => {
    expect(persistedEntityTypeFromCanonical("faction")).toBe("faction");
    expect(persistedEntityTypeFromCanonical("location")).toBe("location");
  });

  it("leaves non-shell kinds as-is", () => {
    expect(persistedEntityTypeFromCanonical("quest")).toBe("quest");
    expect(loreShellKindFromCanonical("quest")).toBeNull();
  });

  it("isLoreCardPersistedEntityType matches lore shells only", () => {
    expect(isLoreCardPersistedEntityType("character")).toBe(true);
    expect(isLoreCardPersistedEntityType("faction")).toBe(true);
    expect(isLoreCardPersistedEntityType("location")).toBe(true);
    expect(isLoreCardPersistedEntityType("npc")).toBe(false);
    expect(isLoreCardPersistedEntityType("quest")).toBe(false);
    expect(isLoreCardPersistedEntityType(null)).toBe(false);
  });

  it("ALL_CANONICAL_KINDS lists every canonical kind", () => {
    expect(ALL_CANONICAL_KINDS).toContain("npc");
    expect(ALL_CANONICAL_KINDS.length).toBe(7);
  });
});
