import { describe, expect, it } from "vitest";

import { buildCollabMergeProtectedContentIds } from "@/src/lib/heartgarden-space-change-sync-utils";

describe("buildCollabMergeProtectedContentIds", () => {
  it("is empty when focus is closed", () => {
    expect(
      buildCollabMergeProtectedContentIds({
        focusOpen: false,
        focusDirty: true,
        activeNodeId: "a",
        inlineContentDirtyIds: new Set(),
      }).size,
    ).toBe(0);
  });

  it("is empty when focus is open but not dirty", () => {
    expect(
      buildCollabMergeProtectedContentIds({
        focusOpen: true,
        focusDirty: false,
        activeNodeId: "a",
        inlineContentDirtyIds: new Set(),
      }).size,
    ).toBe(0);
  });

  it("is empty when focus is dirty but active node id is null", () => {
    expect(
      buildCollabMergeProtectedContentIds({
        focusOpen: true,
        focusDirty: true,
        activeNodeId: null,
        inlineContentDirtyIds: new Set(),
      }).size,
    ).toBe(0);
  });

  it("includes active node when focus is open, dirty, and id is set", () => {
    const s = buildCollabMergeProtectedContentIds({
      focusOpen: true,
      focusDirty: true,
      activeNodeId: "note-1",
      inlineContentDirtyIds: new Set(),
    });
    expect([...s]).toEqual(["note-1"]);
  });

  it("unions inline dirty ids with focused dirty node", () => {
    const s = buildCollabMergeProtectedContentIds({
      focusOpen: true,
      focusDirty: true,
      activeNodeId: "a",
      inlineContentDirtyIds: new Set(["b", "c"]),
    });
    expect([...s].sort()).toEqual(["a", "b", "c"]);
  });

  it("includes inline dirty ids even when focus is not protecting", () => {
    const s = buildCollabMergeProtectedContentIds({
      focusOpen: false,
      focusDirty: false,
      activeNodeId: null,
      inlineContentDirtyIds: new Set(["x"]),
    });
    expect([...s]).toEqual(["x"]);
  });
});
