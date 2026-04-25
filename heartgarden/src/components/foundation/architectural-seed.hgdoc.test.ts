import { describe, expect, it } from "vitest";

import { buildArchitecturalSeedGraph } from "@/src/components/foundation/architectural-seed";
import { hgDocToPlainText } from "@/src/lib/hg-doc/serialize";

const TOKENS = {
  done: "done",
  mediaFrame: "mediaFrame",
  mediaImage: "mediaImage",
  mediaImageActions: "mediaImageActions",
  mediaUploadBtn: "mediaUploadBtn",
  taskCheckbox: "taskCheckbox",
  taskItem: "taskItem",
  taskText: "taskText",
};

describe("architectural seed hgDoc migration", () => {
  it("default/task/code demo cards carry bodyDoc in default scenario", () => {
    const graph = buildArchitecturalSeedGraph(TOKENS, "default");
    const content = Object.values(graph.entities).filter(
      (e) => e.kind === "content"
    );
    for (const entity of content) {
      if (entity.loreCard) {
        continue;
      }
      if (
        entity.theme === "default" ||
        entity.theme === "task" ||
        entity.theme === "code"
      ) {
        expect(entity.bodyDoc).toBeTruthy();
        expect(hgDocToPlainText(entity.bodyDoc!).trim().length).toBeGreaterThan(
          0
        );
      }
    }
  });
});
