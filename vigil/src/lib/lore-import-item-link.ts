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
  return t === "pin" ? "reference" : t;
}

type NoteFolderSlot = { clientId: string; folderClientId: string | null | undefined };

type PlanLinkDraft = {
  fromClientId: string;
  toClientId: string;
  linkType?: string;
};

/**
 * `item_links` are only created between items in the same `items.space_id`
 * (`validateLinkTargetsInSourceSpace`). Drop links that span different import
 * folders / root so apply does not fail silently beyond a generic error.
 */
export function filterPlanLinksToSameCanvasSpace(
  notes: NoteFolderSlot[],
  links: PlanLinkDraft[],
): { links: PlanLinkDraft[]; warnings: string[] } {
  const folderKey = (folderClientId: string | null | undefined) =>
    folderClientId ?? "__root__";

  const byClient = new Map(notes.map((n) => [n.clientId, folderKey(n.folderClientId)]));
  const warnings: string[] = [];
  const out: PlanLinkDraft[] = [];

  for (const l of links) {
    const fromKey = byClient.get(l.fromClientId);
    const toKey = byClient.get(l.toClientId);
    if (fromKey === undefined || toKey === undefined) {
      warnings.push(
        `Dropped link ${l.fromClientId} → ${l.toClientId}: unknown note id (links must reference planned notes).`,
      );
      continue;
    }
    if (fromKey !== toKey) {
      warnings.push(
        `Dropped link ${l.fromClientId} → ${l.toClientId}: cross-space links are not supported. Put both topics in the same folder, or add a pin thread on the canvas after import.`,
      );
      continue;
    }
    out.push({
      fromClientId: l.fromClientId,
      toClientId: l.toClientId,
      linkType: normalizeImportItemLinkType(l.linkType),
    });
  }

  return { links: out, warnings };
}
