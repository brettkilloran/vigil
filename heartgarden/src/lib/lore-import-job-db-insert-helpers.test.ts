import { describe, expect, it } from "vitest";

import {
  isLoreImportJobSchemaLagError,
  readLoreImportJobInsertError,
} from "@/src/lib/lore-import-job-db-insert-helpers";

describe("lore-import-job-db-insert-helpers", () => {
  it("detects missing user_context column as schema-lag", () => {
    const err = {
      code: "42703",
      column: "user_context",
      message: 'column "user_context" of relation "lore_import_jobs" does not exist',
    };
    const diag = readLoreImportJobInsertError(err);
    expect(isLoreImportJobSchemaLagError(diag)).toBe(true);
  });

  it("does not treat primary key violations as schema-lag", () => {
    const err = { code: "23505", message: "duplicate key value violates unique constraint" };
    const diag = readLoreImportJobInsertError(err);
    expect(isLoreImportJobSchemaLagError(diag)).toBe(false);
  });
});
