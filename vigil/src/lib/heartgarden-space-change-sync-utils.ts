/**
 * Pure logic shared by {@link useHeartgardenSpaceChangeSync}: which item ids must keep
 * local title/body during delta merge (focus overlay dirty + inline card drafts).
 */
export function buildCollabMergeProtectedContentIds(options: {
  focusOpen: boolean;
  focusDirty: boolean;
  activeNodeId: string | null;
  inlineContentDirtyIds: ReadonlySet<string>;
}): Set<string> {
  const out = new Set<string>();
  const { focusOpen, focusDirty, activeNodeId, inlineContentDirtyIds } = options;
  if (focusOpen && focusDirty && activeNodeId) {
    out.add(activeNodeId);
  }
  inlineContentDirtyIds.forEach((id) => out.add(id));
  return out;
}
