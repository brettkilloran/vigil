import { describe, expect, it } from "vitest";

import { loreImportPlanPostBodySchema } from "@/src/lib/lore-import-plan-post-body";

describe("loreImportPlanPostBodySchema", () => {
  it("accepts minimal valid body", () => {
    const r = loreImportPlanPostBodySchema.safeParse({
      spaceId: "11111111-1111-4111-8111-111111111111",
      text: "hello",
    });
    expect(r.success).toBe(true);
  });

  it("rejects client-supplied importBatchId (unknown key under .strict())", () => {
    const r = loreImportPlanPostBodySchema.safeParse({
      importBatchId: "22222222-2222-4222-8222-222222222222",
      spaceId: "11111111-1111-4111-8111-111111111111",
      text: "hello",
    });
    expect(r.success).toBe(false);
  });
});
