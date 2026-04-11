import { describe, expect, it } from "vitest";

import {
  buildOutlineChunkListPayload,
  OUTLINE_CHUNK_LIST_JSON_MAX,
} from "@/src/lib/lore-import-plan-llm";
import type { SourceTextChunk } from "@/src/lib/lore-import-chunk";

function makeChunks(n: number): SourceTextChunk[] {
  const out: SourceTextChunk[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: `chunk-${i}`,
      heading: `Section ${i}`,
      body: "x".repeat(4000),
      charStart: i * 4000,
      charEnd: (i + 1) * 4000,
    });
  }
  return out;
}

describe("buildOutlineChunkListPayload", () => {
  it("keeps JSON under the outline budget while preserving every chunk id", () => {
    const chunks = makeChunks(180);
    const list = buildOutlineChunkListPayload(chunks);
    expect(list.length).toBe(chunks.length);
    const json = JSON.stringify(list);
    expect(json.length).toBeLessThanOrEqual(OUTLINE_CHUNK_LIST_JSON_MAX + 500);
    const ids = new Set(list.map((c) => c.id));
    expect(ids.size).toBe(chunks.length);
  });
});
