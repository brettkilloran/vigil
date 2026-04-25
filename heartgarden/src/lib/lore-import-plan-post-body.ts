import { z } from "zod";

import { loreImportUserContextSchema } from "@/src/lib/lore-import-plan-types";

/** JSON body for `POST /api/lore/import/plan`. `importBatchId` is never client-supplied (server-issued). */
export const loreImportPlanPostBodySchema = z
  .object({
    text: z.string().min(1).max(500_000),
    spaceId: z.string().uuid(),
    fileName: z.string().max(512).optional(),
    persistReview: z.boolean().optional(),
    userContext: loreImportUserContextSchema.optional(),
  })
  .strict();

export type LoreImportPlanPostBody = z.infer<
  typeof loreImportPlanPostBodySchema
>;
