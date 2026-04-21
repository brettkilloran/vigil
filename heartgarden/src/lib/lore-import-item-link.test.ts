import { describe, expect, it } from "vitest";

import {
  filterPlanLinksToSameCanvasSpace,
  normalizeImportItemLinkType,
} from "@/src/lib/lore-import-item-link";

describe("normalizeImportItemLinkType", () => {
  it("maps pin to history for ingestion", () => {
    expect(normalizeImportItemLinkType("pin")).toBe("history");
  });

  it("preserves semantic types", () => {
    expect(normalizeImportItemLinkType("bond")).toBe("bond");
    expect(normalizeImportItemLinkType("faction")).toBe("affiliation");
  });
});

describe("filterPlanLinksToSameCanvasSpace", () => {
  const notes = [
    { clientId: "a", folderClientId: "f1" as string | null },
    { clientId: "b", folderClientId: "f1" },
    { clientId: "c", folderClientId: null },
  ];

  it("keeps links within the same folder", () => {
    const { links, warnings } = filterPlanLinksToSameCanvasSpace(notes, [
      { fromClientId: "a", toClientId: "b", linkType: "bond" },
    ]);
    expect(links).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  it("drops cross-folder links with a warning", () => {
    const { links, warnings } = filterPlanLinksToSameCanvasSpace(notes, [
      { fromClientId: "a", toClientId: "c", linkType: "history" },
    ]);
    expect(links).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
