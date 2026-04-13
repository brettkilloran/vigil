import { describe, expect, it } from "vitest";

import { resolveBootPinTier } from "@/src/lib/heartgarden-boot-session";

describe("resolveBootPinTier", () => {
  it("matches Bishop PIN case-insensitively", () => {
    expect(resolveBootPinTier("ABCDEFGH", "abcdefgh", "", "")).toBe("access");
    expect(resolveBootPinTier("abcdefgh", "ABCDEFGH", "", "")).toBe("access");
  });

  it("matches Players PIN case-insensitively", () => {
    expect(resolveBootPinTier("Z9Z9Z9Z9", "", "z9z9z9z9", "")).toBe("player");
  });

  it("matches demo PIN case-insensitively", () => {
    expect(resolveBootPinTier("DEMODEMO", "", "", "demodemo")).toBe("demo");
  });

  it("returns null when code length is wrong after normalize", () => {
    expect(resolveBootPinTier("short", "abcdefgh", "", "")).toBe(null);
  });
});
