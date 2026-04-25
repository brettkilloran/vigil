import { z } from "zod";
import { hgStructuredBlockSchema } from "@/src/lib/hg-doc/structured-body";
import { CANONICAL_ENTITY_KINDS } from "@/src/lib/lore-import-canonical-kinds";
import { LOCATION_TOP_FIELD_CHAR_CAPS } from "@/src/lib/lore-location-focus-document-html";
import { HEARTGARDEN_NATIONS } from "@/src/lib/lore-nations";

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

/** Import-time hint: soft graph edge vs structured field the user may fill on the card later. */
export const loreImportLinkIntentSchema = z
  .enum(["association", "binding_hint"])
  .optional();

export const loreImportPlanFolderSchema = z.object({
  clientId: z.string().min(1).max(64),
  title: z.string().min(1).max(255),
  parentClientId: z.string().min(1).max(64).nullable().optional(),
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
  toClientId: z.string().min(1).max(64),
  targetTitle: z.string().min(1).max(255),
  linkType: z.string().min(1).max(64),
  linkIntent: loreImportLinkIntentSchema,
});

export type LoreImportCrossFolderMention = z.infer<
  typeof loreImportCrossFolderMentionSchema
>;

export const loreImportSourcePassageSchema = z.object({
  chunkId: z.string().uuid(),
  quote: z.string().min(1).max(4000),
});

const loreImportGenericBodySchema = z.object({
  kind: z.literal("generic"),
  blocks: z.array(hgStructuredBlockSchema).max(400),
});

const loreImportCharacterBodySchema = z.object({
  kind: z.literal("character"),
  name: z.string().max(255),
  role: z.string().max(255).optional(),
  affiliation: z.string().max(255).optional(),
  affiliationFactionClientId: z.string().min(1).max(64).optional(),
  nationality: z.enum(HEARTGARDEN_NATIONS).or(z.literal("")).optional(),
  notesParagraphs: z.array(z.string().max(8000)).max(400),
});

const loreImportLocationBodySchema = z.object({
  kind: z.literal("location"),
  name: z.string().max(LOCATION_TOP_FIELD_CHAR_CAPS.name),
  context: z.string().max(LOCATION_TOP_FIELD_CHAR_CAPS.context).optional(),
  detail: z.string().max(LOCATION_TOP_FIELD_CHAR_CAPS.detail).optional(),
  notesParagraphs: z.array(z.string().max(8000)).max(400),
});

const loreImportFactionBodySchema = z.object({
  kind: z.literal("faction"),
  namePrimary: z.string().max(255),
  nameAccent: z.string().max(255).optional(),
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
  clientId: z.string().min(1).max(64),
  title: z.string().min(1).max(255),
  canonicalEntityKind: z.enum(
    CANONICAL_ENTITY_KINDS as unknown as [string, ...string[]]
  ),
  summary: z.string().max(4000),
  bodyText: z.string().max(120_000),
  body: loreImportStructuredBodySchema.optional(),
  sourcePassages: z.array(loreImportSourcePassageSchema).max(400).optional(),
  folderClientId: z.string().min(1).max(64).nullable().optional(),
  targetItemType: z.string().max(64).nullable().optional(),
  ingestionSignals: ingestionSignalsSchema,
  campaignEpoch: z.number().int().optional(),
  loreHistorical: z.boolean().optional(),
  sourceChunkIds: z.array(z.string().uuid()).optional(),
  crossFolderMentions: z
    .array(loreImportCrossFolderMentionSchema)
    .max(32)
    .optional(),
  targetSpaceId: z.string().uuid().nullable().optional(),
  targetSpaceConfidence: z.number().min(0).max(1).optional(),
  targetSpaceReason: z.string().max(400).optional(),
  relatedItems: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        spaceId: z.string().uuid(),
        title: z.string().max(255),
        score: z.number().min(0).max(1).optional(),
        snippet: z.string().max(1200).optional(),
      })
    )
    .max(40)
    .optional(),
});

export const loreImportSpaceSuggestionSchema = z.object({
  spaceId: z.string().uuid(),
  spaceTitle: z.string().max(255),
  path: z.string().max(1000).optional(),
  score: z.number().min(0).max(1).optional(),
  reason: z.string().max(400).optional(),
});

export const loreImportPlanLinkSchema = z.object({
  fromClientId: z.string().min(1).max(64),
  toClientId: z.string().min(1).max(64),
  linkType: linkTypeSchema,
  linkIntent: loreImportLinkIntentSchema,
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

const ingestionSignalsPatchSchema = z
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
  .strict();

/** Machine-readable edit applied when the user picks a clarification option. */
export const planPatchHintSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("no_op") }),
  z.object({
    op: z.literal("set_note_folder"),
    noteClientId: z.string().min(1).max(64),
    folderClientId: z.string().min(1).max(64).nullable(),
  }),
  z.object({
    op: z.literal("set_link_type"),
    fromClientId: z.string().min(1).max(64),
    toClientId: z.string().min(1).max(64),
    linkType: z.string().min(1).max(64),
  }),
  z.object({
    op: z.literal("remove_link"),
    fromClientId: z.string().min(1).max(64),
    toClientId: z.string().min(1).max(64),
  }),
  z.object({
    op: z.literal("set_ingestion_signals"),
    noteClientId: z.string().min(1).max(64),
    patch: ingestionSignalsPatchSchema,
  }),
  z.object({
    op: z.literal("set_lore_historical"),
    noteClientId: z.string().min(1).max(64),
    loreHistorical: z.boolean(),
  }),
  z.object({
    op: z.literal("discard_merge_proposal"),
    mergeProposalId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("assign_chunk_to_note"),
    chunkId: z.string().uuid(),
    noteClientId: z.string().min(1).max(64),
  }),
  z.object({
    op: z.literal("unassign_chunk"),
    chunkId: z.string().uuid(),
    /** When set, only drops the chunk from this note; otherwise drops from every note. */
    noteClientId: z.string().min(1).max(64).optional(),
  }),
]);

export type PlanPatchHint = z.infer<typeof planPatchHintSchema>;

export const loreImportClarificationOptionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(500),
  recommended: z.boolean().optional(),
  planPatchHint: planPatchHintSchema,
});

export const loreImportClarificationItemSchema = z.object({
  id: z.string().uuid(),
  category: z.enum(["structure", "link_semantics", "canon_weight", "conflict"]),
  severity: z.enum(["required", "optional"]),
  /** 0..1 confidence from planner; lower values should be asked earlier. */
  confidenceScore: z.number().min(0).max(1).optional(),
  title: z.string().min(1).max(300),
  context: z.string().max(4000).optional(),
  questionKind: z.enum(["single_select", "multi_select", "confirm_default"]),
  options: z.array(loreImportClarificationOptionSchema).min(2).max(12),
  relatedNoteClientIds: z.array(z.string().min(1).max(64)).max(20).optional(),
  relatedMergeProposalId: z.string().uuid().optional(),
  relatedLink: z
    .object({
      fromClientId: z.string().min(1).max(64),
      toClientId: z.string().min(1).max(64),
    })
    .optional(),
});

export type LoreImportClarificationItem = z.infer<
  typeof loreImportClarificationItemSchema
>;

export const clarificationAnswerSchema = z.object({
  clarificationId: z.string().uuid(),
  resolution: z.enum([
    "answered",
    "skipped_default",
    "other_text",
    "skipped_best_judgement",
  ]),
  selectedOptionIds: z.array(z.string().min(1).max(64)).max(12).optional(),
  skipDefaultOptionId: z.string().min(1).max(64).optional(),
  otherText: z.string().max(2000).optional(),
});

export type ClarificationAnswer = z.infer<typeof clarificationAnswerSchema>;

export const loreImportUserContextSchema = z.object({
  granularity: z.enum(["one_note", "many"]),
  orgMode: z.enum(["folders", "nearby"]),
  importScope: z
    .enum(["current_subtree", "gm_workspace"])
    .optional()
    .default("current_subtree"),
  freeformContext: z.string().max(4000).optional(),
  docSourceKind: z.enum(["pdf", "docx", "markdown", "text"]).optional(),
});

export type LoreImportUserContext = z.infer<typeof loreImportUserContextSchema>;

export const loreImportOneNoteSourceSchema = z.object({
  title: z.string().max(255).optional(),
  text: z.string().max(500_000),
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
        /** Full chunk body (kept on the plan so patches can rebuild note bodies at apply). */
        body: z.string().max(32_000).optional(),
      })
    )
    .optional(),
  folders: z.array(loreImportPlanFolderSchema),
  notes: z.array(loreImportPlanNoteSchema),
  links: z.array(loreImportPlanLinkSchema),
  mergeProposals: z.array(mergeProposalSchema),
  contradictions: z.array(contradictionSchema),
  spaceSuggestions: z
    .array(loreImportSpaceSuggestionSchema)
    .max(128)
    .optional(),
  /** LLM + validation: open questions; required items block apply until answered. */
  clarifications: z
    .array(loreImportClarificationItemSchema)
    .optional()
    .default([]),
  /** Server-generated: cross-space link drops, etc. (round-tripped through apply). */
  importPlanWarnings: z.array(z.string().max(600)).max(48).optional(),
  userContext: loreImportUserContextSchema.optional(),
  oneNoteSource: loreImportOneNoteSourceSchema.optional(),
});

export type LoreImportPlan = z.infer<typeof loreImportPlanSchema>;
export type LoreImportPlanNote = z.infer<typeof loreImportPlanNoteSchema>;
export type MergeProposal = z.infer<typeof mergeProposalSchema>;

export function buildDefaultEntityMeta(
  note: LoreImportPlanNote
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    import: true,
    canonicalEntityKind: note.canonicalEntityKind,
    campaignEpoch: note.campaignEpoch ?? undefined,
    loreHistorical: note.loreHistorical ?? false,
    ingestionSignals: note.ingestionSignals ?? {},
    aiReview: "pending" as const,
  };
}
