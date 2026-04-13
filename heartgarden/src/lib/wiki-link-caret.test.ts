import { describe, expect, it } from "vitest";

import { findOpenWikiTrigger } from "@/src/lib/wiki-link-caret";

describe("findOpenWikiTrigger", () => {
  it("returns null when no trigger", () => {
    expect(findOpenWikiTrigger("hello")).toBeNull();
  });

  it("parses open wiki segment", () => {
    expect(findOpenWikiTrigger("hello [[foo")).toEqual({
      startPlainOffset: 6,
      query: "foo",
    });
  });

  it("returns null when link already closed", () => {
    expect(findOpenWikiTrigger("x [[a]] y [[b")).toEqual({
      startPlainOffset: 10,
      query: "b",
    });
    expect(findOpenWikiTrigger("[[done]]")).toBeNull();
  });
});
