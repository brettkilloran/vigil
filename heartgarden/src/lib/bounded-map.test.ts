import { describe, expect, it } from "vitest";

import { BoundedMap } from "./bounded-map";

describe("BoundedMap", () => {
  it("evicts least-recently-touched entry once size exceeds cap", () => {
    const m = new BoundedMap<string, number>(3);
    m.set("a", 1);
    m.set("b", 2);
    m.set("c", 3);
    expect(m.size).toBe(3);

    m.set("d", 4);
    expect(m.size).toBe(3);
    expect(m.has("a")).toBe(false);
    expect(m.has("b")).toBe(true);
    expect(m.has("c")).toBe(true);
    expect(m.has("d")).toBe(true);
  });

  it("get promotes an entry so it becomes most-recent", () => {
    const m = new BoundedMap<string, number>(3);
    m.set("a", 1);
    m.set("b", 2);
    m.set("c", 3);

    expect(m.get("a")).toBe(1);

    m.set("d", 4);
    expect(m.has("a")).toBe(true);
    expect(m.has("b")).toBe(false);
    expect(m.has("c")).toBe(true);
    expect(m.has("d")).toBe(true);
  });

  it("set on existing key promotes recency without growing size", () => {
    const m = new BoundedMap<string, number>(2);
    m.set("a", 1);
    m.set("b", 2);
    m.set("a", 11);
    expect(m.size).toBe(2);

    m.set("c", 3);
    expect(m.has("a")).toBe(true);
    expect(m.has("b")).toBe(false);
    expect(m.has("c")).toBe(true);
    expect(m.get("a")).toBe(11);
  });

  it("rejects non-positive maxSize", () => {
    expect(() => new BoundedMap<string, number>(0)).toThrow();
    expect(() => new BoundedMap<string, number>(-1)).toThrow();
    expect(() => new BoundedMap<string, number>(Number.NaN)).toThrow();
  });
});
