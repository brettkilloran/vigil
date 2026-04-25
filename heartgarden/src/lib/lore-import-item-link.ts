import { normalizeLoreLinkType } from "@/src/lib/lore-import-commit";

/**
 * User-drawn canvas threads use `link_type: "pin"` with encoded pin anchors.
 * Bulk import rows use `source_pin` / `target_pin` null; the shell applies
 * default pins when hydrating (`mergeHydratedDbConnections`). Imported edges
 * should therefore use **semantic** link types so graph styling and lore tools
 * stay meaningful — never persist `"pin"` from ingestion.
 */
export function normalizeImportItemLinkType(raw: string | undefined): string {
  const t = normalizeLoreLinkType(raw);
  return t === "pin" ? "history" : t;
}

type NoteFolderSlot = {
  clientId: string;
  folderClientId: string | null | undefined;
};

type PlanLinkDraft = {
  fromClientId: string;
  toClientId: string;
  linkType?: string;
  linkIntent?: "association" | "binding_hint";
};

/**
 * Global brane links are allowed, so import links no longer require same-folder filtering.
 * Keep the helper for call-site stability while returning links unchanged.
 *
 * @see docs/LORE_IMPORT_AUDIT_2026-04-21.md §4.2 and plan §5.
 */
export function filterPlanLinksToSameCanvasSpace(
  notes: NoteFolderSlot[],
  links: PlanLinkDraft[]
): {
  links: PlanLinkDraft[];
  crossSpaceMentions: PlanLinkDraft[];
  warnings: string[];
} {
  const noteIds = new Set(notes.map((n) => n.clientId));
  const out: PlanLinkDraft[] = [];
  const warnings: string[] = [];
  for (const link of links) {
    if (!(noteIds.has(link.fromClientId) && noteIds.has(link.toClientId))) {
      warnings.push(
        `Dropped link ${link.fromClientId} → ${link.toClientId}: unknown note id (links must reference planned notes).`
      );
      continue;
    }
    out.push({
      fromClientId: link.fromClientId,
      toClientId: link.toClientId,
      linkType: normalizeImportItemLinkType(link.linkType),
      ...(link.linkIntent ? { linkIntent: link.linkIntent } : {}),
    });
  }
  return { links: out, crossSpaceMentions: [], warnings };
}
