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

type NoteFolderSlot = { clientId: string; folderClientId: string | null | undefined };

type PlanLinkDraft = {
  fromClientId: string;
  toClientId: string;
  linkType?: string;
  linkIntent?: "association" | "binding_hint";
};

/**
 * `item_links` are only created between items in the same `items.space_id`
 * (`validateLinkTargetsInSourceSpace`). Instead of silently dropping links that
 * span different import folders, split them into `crossSpaceMentions` so the
 * plan-build / apply layers can turn them into prose mentions (`[[Title]]` +
 * `vigil:item:<uuid>`) on the source card and `entity_meta.crossFolderRefs`.
 *
 * @see docs/LORE_IMPORT_AUDIT_2026-04-21.md §4.2 and plan §5.
 */
export function filterPlanLinksToSameCanvasSpace(
  notes: NoteFolderSlot[],
  links: PlanLinkDraft[],
): {
  links: PlanLinkDraft[];
  crossSpaceMentions: PlanLinkDraft[];
  warnings: string[];
} {
  const folderKey = (folderClientId: string | null | undefined) =>
    folderClientId ?? "__root__";

  const byClient = new Map(notes.map((n) => [n.clientId, folderKey(n.folderClientId)]));
  const warnings: string[] = [];
  const out: PlanLinkDraft[] = [];
  const crossSpaceMentions: PlanLinkDraft[] = [];

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
      crossSpaceMentions.push({
        fromClientId: l.fromClientId,
        toClientId: l.toClientId,
        linkType: normalizeImportItemLinkType(l.linkType),
        ...(l.linkIntent ? { linkIntent: l.linkIntent } : {}),
      });
      warnings.push(
        `Converted link ${l.fromClientId} → ${l.toClientId} to a cross-folder mention (they live in different spaces).`,
      );
      continue;
    }
    out.push({
      fromClientId: l.fromClientId,
      toClientId: l.toClientId,
      linkType: normalizeImportItemLinkType(l.linkType),
      ...(l.linkIntent ? { linkIntent: l.linkIntent } : {}),
    });
  }

  return { links: out, crossSpaceMentions, warnings };
}
