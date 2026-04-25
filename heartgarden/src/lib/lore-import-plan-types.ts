import { z } from "zod";

import { hgStructuredBlockSchema } from "@/src/lib/hg-doc/structured-body";
import { CANONICAL_ENTITY_KINDS } from "@/src/lib/lore-import-canonical-kinds";
import { LOCATION_TOP_FIELD_CHAR_CAPS } from "@/src/lib/lore-location-focus-document-html";
import { HEARTGARDEN_NATIONS } from "@/src/lib/lore-nations";

export const ingestionSignalsSchema = z
  .object({
    importance: z.number().min(0).max(1).optional(),
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
  })
  .optional();

export type IngestionSignals = z.infer<typeof ingestionSignalsSchema>;

const linkTypeSchema = z.string().max(64).optional();

/** Import-time hint: soft graph edge vs structured field the user may fill on the card later. */
export const loreImportLinkIntentSchema = z
  .enum(["association", "binding_hint"])
  .optional();

export const loreImportPlanFolderSchema = z.object({
  clientId: z.string().min(1).max(64),
  parentClientId: z.string().min(1).max(64).nullable().optional(),
  title: z.string().min(1).max(255),
});

/**
 * References to plan notes in a different folder — surfaced as `[[Title]]` mentions
 * on the source card rather than silently dropped `item_links`. Apply materialises
 * each mention into `entity_meta.crossFolderRefs` metadata once the target row
 * has an id.
 *
 * @see docs/LORE_IMPORT_AUDIT_2026-04-21.md §4.2 and plan §5.
 */
export const loreImportCrossFolderMentionSchema = z.object({
  linkIntent: loreImportLinkIntentSchema,
  linkType: z.string().min(1).max(64),
  targetTitle: z.string().min(1).max(255),
  toClientId: z.string().min(1).max(64),
});

export type LoreImportCrossFolderMention = z.infer<
  typeof loreImportCrossFolderMentionSchema
>;

export const loreImportSourcePassageSchema = z.object({
  chunkId: z.string().uuid(),
  quote: z.string().min(1).max(4000),
});

const loreImportGenericBodySchema = z.object({
  blocks: z.array(hgStructuredBlockSchema).max(400),
  kind: z.literal("generic"),
});

const loreImportCharacterBodySchema = z.object({
  affiliation: z.string().max(255).optional(),
  affiliationFactionClientId: z.string().min(1).max(64).optional(),
  kind: z.literal("character"),
  name: z.string().max(255),
  nationality: z.enum(HEARTGARDEN_NATIONS).or(z.literal("")).optional(),
  notesParagraphs: z.array(z.string().max(8000)).max(400),
  role: z.string().max(255).optional(),
});

const loreImportLocationBodySchema = z.object({
  context: z.string().max(LOCATION_TOP_FIELD_CHAR_CAPS.context).optional(),
  detail: z.string().max(LOCATION_TOP_FIELD_CHAR_CAPS.detail).optional(),
  kind: z.literal("location"),
  name: z.string().max(LOCATION_TOP_FIELD_CHAR_CAPS.name),
  notesParagraphs: z.array(z.string().max(8000)).max(400),
});

const loreImportFactionBodySchema = z.object({
  kind: z.literal("faction"),
  nameAccent: z.string().max(255).optional(),
  namePrimary: z.string().max(255),
  recordParagraphs: z.array(z.string().max(8000)).max(400),
});

export const loreImportStructuredBodySchema = z.discriminatedUnion("kind", [
  loreImportCharacterBodySchema,
  loreImportLocationBodySchema,
  loreImportFactionBodySchema,
  loreImportGenericBodySchema,
]);

export type LoreImportStructuredBody = z.infer<
  typeof loreImportStructuredBodySchema
>;

export const loreImportPlanNoteSchema = z.object({
  body: loreImportStructuredBodySchema.optional(),
  bodyText: z.string().max(120_000),
  campaignEpoch: z.number().int().optional(),
  canonicalEntityKind: z.enum(
    CANONICAL_ENTITY_KINDS as unknown as [string, ...string[]]
  ),
  clientId: z.string().min(1).max(64),
  crossFolderMentions: z
    .array(loreImportCrossFolderMentionSchema)
    .max(32)
    .optional(),
  folderClientId: z.string().min(1).max(64).nullable().optional(),
  ingestionSignals: ingestionSignalsSchema,
  loreHistorical: z.boolean().optional(),
  relatedItems: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        score: z.number().min(0).max(1).optional(),
        snippet: z.string().max(1200).optional(),
        spaceId: z.string().uuid(),
        title: z.string().max(255),
      })
    )
    .max(40)
    .optional(),
  sourceChunkIds: z.array(z.string().uuid()).optional(),
  sourcePassages: z.array(loreImportSourcePassageSchema).max(400).optional(),
  summary: z.string().max(4000),
  targetItemType: z.string().max(64).nullable().optional(),
  targetSpaceConfidence: z.number().min(0).max(1).optional(),
  targetSpaceId: z.string().uuid().nullable().optional(),
  targetSpaceReason: z.string().max(400).optional(),
  title: z.string().min(1).max(255),
});

export const loreImportSpaceSuggestionSchema = z.object({
  path: z.string().max(1000).optional(),
  reason: z.string().max(400).optional(),
  score: z.number().min(0).max(1).optional(),
  spaceId: z.string().uuid(),
  spaceTitle: z.string().max(255),
});

export const loreImportPlanLinkSchema = z.object({
  fromClientId: z.string().min(1).max(64),
  linkIntent: loreImportLinkIntentSchema,
  linkType: linkTypeSchema,
  toClientId: z.string().min(1).max(64),
});

export const mergeProposalSchema = z.object({
  id: z.string().uuid(),
  noteClientId: z.string().min(1).max(64),
  proposedText: z.string().max(120_000),
  rationale: z.string().max(2000).optional(),
  strategy: z.enum(["append_dated", "append_section"]),
  targetEntityType: z.string().max(64).nullable().optional(),
  targetItemId: z.string().uuid(),
  targetItemType: z.string().max(64).nullable().optional(),
  targetSpaceName: z.string().max(255).optional(),
  targetTitle: z.string().max(255),
});

export const contradictionSchema = z.object({
  details: z.string().max(8000).optional(),
  id: z.string().uuid(),
  noteClientId: z.string().min(1).max(64).optional(),
  summary: z.string().max(2000),
});

const ingestionSignalsPatchSchema = z
  .object({
    importance: z.number().min(0).max(1).optional(),
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
  })
  .strict();

/** Machine-readable edit applied when the user picks a clarification option. */
export const planPatchHintSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("no_op") }),
  z.object({
    folderClientId: z.string().min(1).max(64).nullable(),
    noteClientId: z.string().min(1).max(64),
    op: z.literal("set_note_folder"),
  }),
  z.object({
    fromClientId: z.string().min(1).max(64),
    linkType: z.string().min(1).max(64),
    op: z.literal("set_link_type"),
    toClientId: z.string().min(1).max(64),
  }),
  z.object({
    fromClientId: z.string().min(1).max(64),
    op: z.literal("remove_link"),
    toClientId: z.string().min(1).max(64),
  }),
  z.object({
    noteClientId: z.string().min(1).max(64),
    op: z.literal("set_ingestion_signals"),
    patch: ingestionSignalsPatchSchema,
  }),
  z.object({
    loreHistorical: z.boolean(),
    noteClientId: z.string().min(1).max(64),
    op: z.literal("set_lore_historical"),
  }),
  z.object({
    mergeProposalId: z.string().uuid(),
    op: z.literal("discard_merge_proposal"),
  }),
  z.object({
    chunkId: z.string().uuid(),
    noteClientId: z.string().min(1).max(64),
    op: z.literal("assign_chunk_to_note"),
  }),
  z.object({
    chunkId: z.string().uuid(),
    /** When set, only drops the chunk from this note; otherwise drops from every note. */
    noteClientId: z.string().min(1).max(64).optional(),
    op: z.literal("unassign_chunk"),
  }),
]);

export type PlanPatchHint = z.infer<typeof planPatchHintSchema>;

export const loreImportClarificationOptionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(500),
  planPatchHint: planPatchHintSchema,
  recommended: z.boolean().optional(),
});

export const loreImportClarificationItemSchema = z.object({
  category: z.enum(["structure", "link_semantics", "canon_weight", "conflict"]),
  /** 0..1 confidence from planner; lower values should be asked earlier. */
  confidenceScore: z.number().min(0).max(1).optional(),
  context: z.string().max(4000).optional(),
  id: z.string().uuid(),
  options: z.array(loreImportClarificationOptionSchema).min(2).max(12),
  questionKind: z.enum(["single_select", "multi_select", "confirm_default"]),
  relatedLink: z
    .object({
      fromClientId: z.string().min(1).max(64),
      toClientId: z.string().min(1).max(64),
    })
    .optional(),
  relatedMergeProposalId: z.string().uuid().optional(),
  relatedNoteClientIds: z.array(z.string().min(1).max(64)).max(20).optional(),
  severity: z.enum(["required", "optional"]),
  title: z.string().min(1).max(300),
});

export type LoreImportClarificationItem = z.infer<
  typeof loreImportClarificationItemSchema
>;

export const clarificationAnswerSchema = z.object({
  clarificationId: z.string().uuid(),
  otherText: z.string().max(2000).optional(),
  resolution: z.enum([
    "answered",
    "skipped_default",
    "other_text",
    "skipped_best_judgement",
  ]),
  selectedOptionIds: z.array(z.string().min(1).max(64)).max(12).optional(),
  skipDefaultOptionId: z.string().min(1).max(64).optional(),
});

export type ClarificationAnswer = z.infer<typeof clarificationAnswerSchema>;

export const loreImportUserContextSchema = z.object({
  docSourceKind: z.enum(["pdf", "docx", "markdown", "text"]).optional(),
  freeformContext: z.string().max(4000).optional(),
  granularity: z.enum(["one_note", "many"]),
  importScope: z
    .enum(["current_subtree", "gm_workspace"])
    .optional()
    .default("current_subtree"),
  orgMode: z.enum(["folders", "nearby"]),
});

export type LoreImportUserContext = z.infer<typeof loreImportUserContextSchema>;

export const loreImportOneNoteSourceSchema = z.object({
  text: z.string().max(500_000),
  title: z.string().max(255).optional(),
});

export const loreImportPlanSchema = z.object({
  chunks: z
    .array(
      z.object({
        /** Full chunk body (kept on the plan so patches can rebuild note bodies at apply). */
        body: z.string().max(32_000).optional(),
        charEnd: z.number().int(),
        charStart: z.number().int(),
        heading: z.string(),
        id: z.string().uuid(),
      })
    )
    .optional(),
  /** LLM + validation: open questions; required items block apply until answered. */
  clarifications: z
    .array(loreImportClarificationItemSchema)
    .optional()
    .default([]),
  contradictions: z.array(contradictionSchema),
  fileName: z.string().max(512).optional(),
  folders: z.array(loreImportPlanFolderSchema),
  importBatchId: z.string().uuid(),
  /** Server-generated: cross-space link drops, etc. (round-tripped through apply). */
  importPlanWarnings: z.array(z.string().max(600)).max(48).optional(),
  links: z.array(loreImportPlanLinkSchema),
  mergeProposals: z.array(mergeProposalSchema),
  notes: z.array(loreImportPlanNoteSchema),
  oneNoteSource: loreImportOneNoteSourceSchema.optional(),
  sourceCharCount: z.number().int().nonnegative(),
  spaceSuggestions: z
    .array(loreImportSpaceSuggestionSchema)
    .max(128)
    .optional(),
  userContext: loreImportUserContextSchema.optional(),
});

export type LoreImportPlan = z.infer<typeof loreImportPlanSchema>;
export type LoreImportPlanNote = z.infer<typeof loreImportPlanNoteSchema>;
export type MergeProposal = z.infer<typeof mergeProposalSchema>;

export function buildDefaultEntityMeta(
  note: LoreImportPlanNote
): Record<string, unknown> {
  return {
    aiReview: "pending" as const,
    campaignEpoch: note.campaignEpoch ?? undefined,
    canonicalEntityKind: note.canonicalEntityKind,
    import: true,
    ingestionSignals: note.ingestionSignals ?? {},
    loreHistorical: note.loreHistorical ?? false,
    schemaVersion: 1,
  };
}
