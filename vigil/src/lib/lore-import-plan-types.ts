import { z } from "zod";

import { CANONICAL_ENTITY_KINDS } from "@/src/lib/lore-import-canonical-kinds";

export const ingestionSignalsSchema = z
  .object({
    salienceRole: z
      .enum(["crunch", "flavor", "plot_hook", "table_advice", "mixed"])
      .optional(),
    voiceReliability: z
      .enum([
        "in_world_document",
        "narrator",
        "gm_note",
        "player_knowledge",
        "unknown",
      ])
      .optional(),
    importance: z.number().min(0).max(1).optional(),
  })
  .optional();

export type IngestionSignals = z.infer<typeof ingestionSignalsSchema>;

const linkTypeSchema = z.string().max(64).optional();

export const loreImportPlanFolderSchema = z.object({
  clientId: z.string().min(1).max(64),
  title: z.string().min(1).max(255),
  parentClientId: z.string().min(1).max(64).nullable().optional(),
});

export const loreImportPlanNoteSchema = z.object({
  clientId: z.string().min(1).max(64),
  title: z.string().min(1).max(255),
  canonicalEntityKind: z.enum(
    CANONICAL_ENTITY_KINDS as unknown as [string, ...string[]],
  ),
  summary: z.string().max(4000),
  bodyText: z.string().max(120_000),
  folderClientId: z.string().min(1).max(64).nullable().optional(),
  targetItemType: z.string().max(64).nullable().optional(),
  ingestionSignals: ingestionSignalsSchema,
  campaignEpoch: z.number().int().optional(),
  loreHistorical: z.boolean().optional(),
  sourceChunkIds: z.array(z.string().uuid()).optional(),
});

export const loreImportPlanLinkSchema = z.object({
  fromClientId: z.string().min(1).max(64),
  toClientId: z.string().min(1).max(64),
  linkType: linkTypeSchema,
});

export const mergeProposalSchema = z.object({
  id: z.string().uuid(),
  noteClientId: z.string().min(1).max(64),
  targetItemId: z.string().uuid(),
  targetTitle: z.string().max(255),
  targetSpaceName: z.string().max(255).optional(),
  targetItemType: z.string().max(64).nullable().optional(),
  targetEntityType: z.string().max(64).nullable().optional(),
  strategy: z.enum(["append_dated", "append_section"]),
  proposedText: z.string().max(120_000),
  rationale: z.string().max(2000).optional(),
});

export const contradictionSchema = z.object({
  id: z.string().uuid(),
  noteClientId: z.string().min(1).max(64).optional(),
  summary: z.string().max(2000),
  details: z.string().max(8000).optional(),
});

export const loreImportPlanSchema = z.object({
  importBatchId: z.string().uuid(),
  fileName: z.string().max(512).optional(),
  sourceCharCount: z.number().int().nonnegative(),
  chunks: z
    .array(
      z.object({
        id: z.string().uuid(),
        heading: z.string(),
        charStart: z.number().int(),
        charEnd: z.number().int(),
      }),
    )
    .optional(),
  folders: z.array(loreImportPlanFolderSchema),
  notes: z.array(loreImportPlanNoteSchema),
  links: z.array(loreImportPlanLinkSchema),
  mergeProposals: z.array(mergeProposalSchema),
  contradictions: z.array(contradictionSchema),
});

export type LoreImportPlan = z.infer<typeof loreImportPlanSchema>;
export type LoreImportPlanNote = z.infer<typeof loreImportPlanNoteSchema>;
export type MergeProposal = z.infer<typeof mergeProposalSchema>;

export function buildDefaultEntityMeta(note: LoreImportPlanNote): Record<string, unknown> {
  return {
    schemaVersion: 1,
    import: true,
    canonicalEntityKind: note.canonicalEntityKind,
    campaignEpoch: note.campaignEpoch ?? undefined,
    loreHistorical: note.loreHistorical ?? false,
    ingestionSignals: note.ingestionSignals ?? {},
  };
}
