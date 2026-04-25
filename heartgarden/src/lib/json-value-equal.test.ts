import { describe, expect, it } from "vitest";

import { jsonValuesEqualForPatch } from "@/src/lib/json-value-equal";

describe("jsonValuesEqualForPatch", () => {
  it("treats key order as irrelevant for objects", () => {
    expect(
      jsonValuesEqualForPatch({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 })
    ).toBe(true);
  });

  it("detects real value changes", () => {
    expect(jsonValuesEqualForPatch({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("compares null vs missing consistently", () => {
    expect(jsonValuesEqualForPatch(null, null)).toBe(true);
    expect(jsonValuesEqualForPatch(undefined, null)).toBe(true);
  });
});
