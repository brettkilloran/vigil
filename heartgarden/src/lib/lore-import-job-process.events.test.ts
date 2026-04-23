import { describe, expect, it, vi } from "vitest";

import { appendLoreImportJobEvent, appendLoreImportJobEventsBatch } from "@/src/lib/lore-import-job-process";
import type { VigilDb } from "@/src/lib/spaces";

function mockDb() {
  const execute = vi.fn().mockResolvedValue(undefined);
  return { db: { execute } as unknown as VigilDb, execute };
}

describe("appendLoreImportJobEventsBatch", () => {
  it("sends a single update when multiple events are provided", async () => {
    const { db, execute } = mockDb();
    await appendLoreImportJobEventsBatch(db, "job-uid", [
      { kind: "note", text: "a" },
      { kind: "note", text: "b" },
    ]);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("delegates single-event path to the batch implementation", async () => {
    const { db, execute } = mockDb();
    await appendLoreImportJobEvent(db, "job-uid", { kind: "note", text: "one" });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
