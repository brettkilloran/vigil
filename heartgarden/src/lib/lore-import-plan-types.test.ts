import { describe, expect, it } from "vitest";

import { loreImportPlanSchema } from "@/src/lib/lore-import-plan-types";
import { LOCATION_TOP_FIELD_CHAR_CAPS } from "@/src/lib/lore-location-focus-document-html";

const BASE_PLAN = {
  clarifications: [],
  contradictions: [],
  folders: [],
  importBatchId: "11111111-1111-4111-8111-111111111111",
  links: [],
  mergeProposals: [],
  sourceCharCount: 123,
};

function makeLocationNote(overrides?: {
  name?: string;
  context?: string;
  detail?: string;
}) {
  return {
    body: {
      context: overrides?.context,
      detail: overrides?.detail,
      kind: "location",
      name: overrides?.name ?? "A",
      notesParagraphs: [],
    },
    bodyText: "body",
    canonicalEntityKind: "location",
    clientId: "n1",
    summary: "short summary",
    title: "Imported location",
  };
}

describe("loreImportPlanSchema location top-field caps", () => {
  it("accepts location fields at tight limits", () => {
    const parsed = loreImportPlanSchema.safeParse({
      ...BASE_PLAN,
      notes: [
        makeLocationNote({
          context: "C".repeat(LOCATION_TOP_FIELD_CHAR_CAPS.context),
          detail: "D".repeat(LOCATION_TOP_FIELD_CHAR_CAPS.detail),
          name: "N".repeat(LOCATION_TOP_FIELD_CHAR_CAPS.name),
        }),
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects location fields above tight limits", () => {
    const parsed = loreImportPlanSchema.safeParse({
      ...BASE_PLAN,
      notes: [
        makeLocationNote({
          name: "N".repeat(LOCATION_TOP_FIELD_CHAR_CAPS.name + 1),
        }),
      ],
    });
    expect(parsed.success).toBe(false);
  });
});
