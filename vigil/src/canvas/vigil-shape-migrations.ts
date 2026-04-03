import { createMigrationSequence } from "@tldraw/store";

// sequenceId must be `com.tldraw.shape.<type>` — see processPropsMigrations in @tldraw/tlschema.

/** Initial props version for vigil-note (expand in later phases). */
export const vigilNoteShapeMigrations = createMigrationSequence({
  sequenceId: "com.tldraw.shape.vigil-note",
  retroactive: true,
  sequence: [
    {
      id: "com.tldraw.shape.vigil-note/1",
      scope: "record",
      filter: (r) => {
        const rec = r as { typeName?: string; type?: string };
        return rec.typeName === "shape" && rec.type === "vigil-note";
      },
      up: (record) => record,
    },
  ],
});

export const vigilStickyShapeMigrations = createMigrationSequence({
  sequenceId: "com.tldraw.shape.vigil-sticky",
  retroactive: true,
  sequence: [
    {
      id: "com.tldraw.shape.vigil-sticky/1",
      scope: "record",
      filter: (r) => {
        const rec = r as { typeName?: string; type?: string };
        return rec.typeName === "shape" && rec.type === "vigil-sticky";
      },
      up: (record) => record,
    },
  ],
});
