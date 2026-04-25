import { describe, expect, it } from "vitest";
import { loreImportPlanSchema } from "@/src/lib/lore-import-plan-types";
import { LOCATION_TOP_FIELD_CHAR_CAPS } from "@/src/lib/lore-location-focus-document-html";

const BASE_PLAN = {
  importBatchId: "11111111-1111-4111-8111-111111111111",
  sourceCharCount: 123,
  folders: [],
  links: [],
  mergeProposals: [],
  contradictions: [],
  clarifications: [],
};

function makeLocationNote(overrides?: {
  name?: string;
  context?: string;
  detail?: string;
}) {
  return {
    clientId: "n1",
    title: "Imported location",
    canonicalEntityKind: "location",
    summary: "short summary",
    bodyText: "body",
    body: {
      kind: "location",
      name: overrides?.name ?? "A",
      context: overrides?.context,
      detail: overrides?.detail,
      notesParagraphs: [],
    },
  };
}

describe("loreImportPlanSchema location top-field caps", () => {
  it("accepts location fields at tight limits", () => {
    const parsed = loreImportPlanSchema.safeParse({
      ...BASE_PLAN,
      notes: [
        makeLocationNote({
          name: "N".repeat(LOCATION_TOP_FIELD_CHAR_CAPS.name),
          context: "C".repeat(LOCATION_TOP_FIELD_CHAR_CAPS.context),
          detail: "D".repeat(LOCATION_TOP_FIELD_CHAR_CAPS.detail),
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
