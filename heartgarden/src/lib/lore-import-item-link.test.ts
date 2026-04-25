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
    const { links, crossSpaceMentions, warnings } = filterPlanLinksToSameCanvasSpace(notes, [
      { fromClientId: "a", toClientId: "b", linkType: "bond" },
    ]);
    expect(links).toHaveLength(1);
    expect(crossSpaceMentions).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("keeps cross-folder links because the brane allows global linking", () => {
    const { links, crossSpaceMentions, warnings } = filterPlanLinksToSameCanvasSpace(
      notes,
      [{ fromClientId: "a", toClientId: "c", linkType: "history" }],
    );
    expect(links).toHaveLength(1);
    expect(links[0]?.fromClientId).toBe("a");
    expect(links[0]?.toClientId).toBe("c");
    expect(crossSpaceMentions).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("drops links that reference unknown note ids", () => {
    const { links, crossSpaceMentions, warnings } = filterPlanLinksToSameCanvasSpace(
      notes,
      [{ fromClientId: "a", toClientId: "ghost", linkType: "history" }],
    );
    expect(links).toHaveLength(0);
    expect(crossSpaceMentions).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatch(/unknown note id/);
  });

  it("normalises pin on co-located edges to history", () => {
    const { links } = filterPlanLinksToSameCanvasSpace(notes, [
      { fromClientId: "a", toClientId: "b", linkType: "pin" },
    ]);
    expect(links[0]?.linkType).toBe("history");
  });
});
