import { describe, expect, it } from "vitest";

import {
  mergeRemoteItemPatches,
  type BootstrapResponse,
  buildCanvasGraphFromBootstrap,
} from "@/src/components/foundation/architectural-db-bridge";
import type { CanvasItem } from "@/src/model/canvas-types";

function noteItem(id: string, spaceId: string, title: string, updatedAt: string): CanvasItem {
  return {
    id,
    spaceId,
    itemType: "note",
    x: 0,
    y: 0,
    width: 280,
    height: 200,
    zIndex: 1,
    title,
    contentText: "",
    contentJson: { format: "html", html: "<div contenteditable=\"true\">x</div>" },
    updatedAt,
  };
}

describe("mergeRemoteItemPatches", () => {
  it("updates title from changed item and removes deleted id", () => {
    const boot: BootstrapResponse = {
      ok: true,
      demo: false,
      spaceId: "space-1",
      spaces: [{ id: "space-1", name: "Root", parentSpaceId: null, updatedAt: "2020-01-01T00:00:00.000Z" }],
      items: [noteItem("a", "space-1", "A", "2020-01-01T00:00:00.000Z"), noteItem("b", "space-1", "B", "2020-01-01T00:00:00.000Z")],
      camera: { x: 0, y: 0, zoom: 1 },
    };
    const prev = buildCanvasGraphFromBootstrap(boot);
    const changed = [noteItem("a", "space-1", "A2", "2020-01-02T00:00:00.000Z")];
    const serverIds = new Set<string>(["a"]);
    const next = mergeRemoteItemPatches(prev, changed, serverIds, ["space-1"]);
    expect(next.entities.a?.title).toBe("A2");
    expect(next.entities.b).toBeUndefined();
    expect(next.spaces["space-1"]?.entityIds).toEqual(["a"]);
  });
});
