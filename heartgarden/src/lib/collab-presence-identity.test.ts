import { describe, expect, it } from "vitest";

import {
  presenceFallbackAliasForClientId,
  presenceHueForClientId,
  presenceInitialsFromName,
  presenceNameForClient,
  sanitizePresenceDisplayName,
} from "@/src/lib/collab-presence-identity";

describe("collab-presence-identity", () => {
  it("fallback alias is deterministic per client id", () => {
    const id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    expect(presenceFallbackAliasForClientId(id)).toBe(
      presenceFallbackAliasForClientId(id)
    );
  });

  it("hue is in 0..359", () => {
    const h = presenceHueForClientId("bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  });

  it("sanitizes display names", () => {
    expect(sanitizePresenceDisplayName("  Avery   North  ")).toBe(
      "Avery North"
    );
    expect(sanitizePresenceDisplayName("")).toBeNull();
    expect(sanitizePresenceDisplayName("    ")).toBeNull();
  });

  it("uses fallback alias when display name is invalid", () => {
    const id = "cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    expect(presenceNameForClient(id, "###")).toBe(
      presenceFallbackAliasForClientId(id)
    );
  });

  it("builds compact initials", () => {
    expect(presenceInitialsFromName("Avery North")).toBe("AN");
    expect(presenceInitialsFromName("Kai")).toBe("KA");
  });
});
