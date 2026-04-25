import type {
  LoreImportPlan,
  LoreImportUserContext,
  PlanPatchHint,
} from "@/src/lib/lore-import-plan-types";

function withUserContext(
  plan: LoreImportPlan,
  patch: Partial<LoreImportUserContext>
): LoreImportUserContext {
  return {
    docSourceKind: patch.docSourceKind ?? plan.userContext?.docSourceKind,
    freeformContext: patch.freeformContext ?? plan.userContext?.freeformContext,
    granularity: patch.granularity ?? plan.userContext?.granularity ?? "many",
    importScope:
      patch.importScope ?? plan.userContext?.importScope ?? "current_subtree",
    orgMode: patch.orgMode ?? plan.userContext?.orgMode ?? "folders",
  };
}

function isPlanPatchHintSatisfied(
  plan: LoreImportPlan,
  hint: PlanPatchHint
): boolean {
  if (hint.op === "no_op") {
    return true;
  }
  if (hint.op === "set_note_folder") {
    const note = plan.notes.find((n) => n.clientId === hint.noteClientId);
    if (!note) {
      return true;
    }
    return (note.folderClientId ?? null) === (hint.folderClientId ?? null);
  }
  if (hint.op === "discard_merge_proposal") {
    return !plan.mergeProposals.some((m) => m.id === hint.mergeProposalId);
  }
  return false;
}

export function filterAutoResolvedClarifications(
  plan: LoreImportPlan
): LoreImportPlan {
  if (plan.userContext?.granularity === "one_note") {
    return { ...plan, clarifications: [] };
  }
  const orgMode = plan.userContext?.orgMode ?? "folders";
  const clarifications = (plan.clarifications ?? []).filter((c) => {
    if (c.relatedMergeProposalId) {
      const exists = plan.mergeProposals.some(
        (m) => m.id === c.relatedMergeProposalId
      );
      if (!exists) {
        return false;
      }
    }
    if (orgMode === "nearby" && c.category === "structure") {
      return false;
    }
    return !c.options.every((o) =>
      isPlanPatchHintSatisfied(plan, o.planPatchHint)
    );
  });
  return { ...plan, clarifications };
}

export function flipOrgMode(
  plan: LoreImportPlan,
  orgMode: "folders" | "nearby"
): LoreImportPlan {
  return filterAutoResolvedClarifications({
    ...plan,
    userContext: withUserContext(plan, { granularity: "many", orgMode }),
  });
}

export function collapseToOneNote(
  plan: LoreImportPlan,
  oneNoteSource: { text: string; title?: string }
): LoreImportPlan {
  const next: LoreImportPlan = {
    ...plan,
    contradictions: [],
    folders: [],
    links: [],
    mergeProposals: [],
    notes: [],
    oneNoteSource: {
      text: oneNoteSource.text.slice(0, 500_000),
      ...(oneNoteSource.title
        ? { title: oneNoteSource.title.slice(0, 255) }
        : {}),
    },
    userContext: withUserContext(plan, {
      granularity: "one_note",
      orgMode: "nearby",
    }),
  };
  return filterAutoResolvedClarifications(next);
}
