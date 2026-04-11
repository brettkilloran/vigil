import { describe, expect, it } from "vitest";

import { buildArchitecturalSeedGraph } from "@/src/components/foundation/architectural-seed";

const TOKENS = {
  taskItem: "taskItem",
  done: "done",
  taskCheckbox: "taskCheckbox",
  taskText: "taskText",
  mediaFrame: "mediaFrame",
  mediaImage: "mediaImage",
  mediaImageActions: "mediaImageActions",
  mediaUploadBtn: "mediaUploadBtn",
};

describe("architectural seed hgDoc migration", () => {
  it("default/task demo cards carry bodyDoc in default scenario", () => {
    const graph = buildArchitecturalSeedGraph(TOKENS, "default");
    const content = Object.values(graph.entities).filter((e) => e.kind === "content");
    for (const entity of content) {
      if (entity.theme === "default" || entity.theme === "task") {
        expect(entity.bodyDoc).toBeTruthy();
      }
    }
  });

  it("nested scenario default cards also carry bodyDoc", () => {
    const graph = buildArchitecturalSeedGraph(TOKENS, "nested");
    const content = Object.values(graph.entities).filter((e) => e.kind === "content");
    const defaults = content.filter((e) => e.theme === "default" || e.theme === "task");
    expect(defaults.length).toBeGreaterThan(0);
    for (const entity of defaults) {
      expect(entity.bodyDoc).toBeTruthy();
    }
  });
});

