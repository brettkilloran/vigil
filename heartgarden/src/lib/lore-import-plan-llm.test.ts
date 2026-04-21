import { describe, expect, it } from "vitest";

import {
  buildOutlineChunkListPayload,
  fillNoteBodiesFromChunks,
  OUTLINE_CHUNK_LIST_JSON_MAX,
} from "@/src/lib/lore-import-plan-llm";
import type { SourceTextChunk } from "@/src/lib/lore-import-chunk";

function makeChunks(n: number): SourceTextChunk[] {
  const out: SourceTextChunk[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: `chunk-${i}`,
      heading: `Section ${i}`,
      body: `body-${i}-${"x".repeat(Math.max(0, 3990 - String(i).length))}`,
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

describe("fillNoteBodiesFromChunks", () => {
  type TestNote = {
    clientId: string;
    title: string;
    sourceChunkIds: string[];
    bodyText?: string;
  };
  const makeNote = (id: string, ids: string[]): TestNote => ({
    clientId: id,
    title: id,
    sourceChunkIds: ids,
    bodyText: "",
  });

  it("does NOT dump unassigned chunks onto the first note", () => {
    const chunks = makeChunks(3);
    const notes: TestNote[] = [makeNote("n0", [chunks[0]!.id])];
    const diagnostics = fillNoteBodiesFromChunks(
      notes as unknown as Parameters<typeof fillNoteBodiesFromChunks>[0],
      chunks,
    );
    expect(notes[0]!.bodyText ?? "").not.toContain(chunks[1]!.body);
    expect(notes[0]!.bodyText ?? "").not.toContain(chunks[2]!.body);
    expect(diagnostics.unassignedChunkIds).toEqual([
      chunks[1]!.id,
      chunks[2]!.id,
    ]);
  });

  it("records notes with zero resolved chunks", () => {
    const chunks = makeChunks(2);
    const notes: TestNote[] = [
      makeNote("n0", [chunks[0]!.id]),
      makeNote("n1", []),
    ];
    const diagnostics = fillNoteBodiesFromChunks(
      notes as unknown as Parameters<typeof fillNoteBodiesFromChunks>[0],
      chunks,
    );
    expect(diagnostics.noteClientIdsWithoutChunks).toEqual(["n1"]);
  });

  it("flags duplicate chunk assignments", () => {
    const chunks = makeChunks(2);
    const notes: TestNote[] = [
      makeNote("a", [chunks[0]!.id]),
      makeNote("b", [chunks[0]!.id, chunks[1]!.id]),
    ];
    const diagnostics = fillNoteBodiesFromChunks(
      notes as unknown as Parameters<typeof fillNoteBodiesFromChunks>[0],
      chunks,
    );
    expect(diagnostics.duplicateAssignments).toHaveLength(1);
    expect(diagnostics.duplicateAssignments[0]!.chunkId).toBe(chunks[0]!.id);
    expect(new Set(diagnostics.duplicateAssignments[0]!.noteClientIds)).toEqual(
      new Set(["a", "b"]),
    );
  });
});
