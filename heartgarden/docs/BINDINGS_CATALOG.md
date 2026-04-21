# Bindings catalog (lore shells)

Engineering source of truth: `src/lib/bindings-catalog.ts` (`BINDING_SLOT_DEFINITIONS`, `LINK_SEMANTICS`, `HGARCH_BINDINGS_SCHEMA_VERSION`, `CROSS_SPACE_LINK_POLICY`).

## Cross-space

All persisted canvas connections (`item_links`) and binding targets must stay **within the same `items.space_id`** as the source item. Folder depth does not change `space_id` until the item is moved; true cross-world / cross-canvas links are out of scope unless validation is revisited (`validateLinkTargetsInSourceSpace`).

## Association vs connection metadata

- **`item_links`**: primary store for **associations** (contextual threads). Optional `meta.linkSemantics`: `association` (default) or `structured_mirror` when the edge mirrors an hgArch slot (`normalizeLinkSemanticsInMeta` in `item-link-meta.ts`, applied in `POST/PATCH /api/item-links`).
- **`content_json.hgArch`**: **bindings** — roster rows, `loreThreadAnchors`, and future slot objects. Authoritative for card chrome and “this card owns that reference.”

## Slots (summary)

| Slot id | Shell | Cardinality | Typical targets |
|--------|-------|-------------|-----------------|
| `faction.factionRoster` | faction | 0–n | characters |
| `character.loreThreadAnchors` | character | 0–n | locations, factions (hints) |
| `location.linkedCharacters` | location | 0–n | characters |
| `character.primaryFactions` | character | 0–n | factions |
| `character.primaryLocations` | character | 0–n | locations |
| `faction.parentNation`, `faction.hqLocation`, `location.parentRegion` | planned | 0–1 | per catalog |

Mirror rules and “who writes what” are listed on each `BindingSlotDefinition` in code.

## Recall and index

- Vault embed text includes a **binding projection** (`buildHgArchBindingSummaryText`, `buildVaultEmbedDocument`).
- Lore Q&A expands **graph neighbors**, **prose `vigil:item` cites**, and **hgArch binding targets** (`expandHgArchBindingNeighbors`).

## Versioning

`HGARCH_BINDINGS_SCHEMA_VERSION` documents the expected shape generation for migrations; readers should ignore unknown hgArch keys.

## Recoverable archive (deletion / restore)

Archived items are **hidden from default listings** but **retain** `item_links` and `content_json` until hard-deleted. Helpers: `src/lib/item-archive.ts` (`isItemArchivedFromEntityMeta`, `entityMetaMergeForArchivePatch`). List routes and canvas loaders filter archived peers where appropriate so dangling threads do not clutter the graph; restoring an item brings its associations back without a separate “re-link” step.

## Prose links vs promoted threads

Wiki-style `[[Title]]` and `vigil:item:` prose resolve through search and **expand into retrieval neighbors** (`expandProseLinkedItems`, `expandHgArchBindingNeighbors`). **Promoting** a prose-only reference to a **canvas thread** is a deliberate UI action (draw link or create `item_links` row with correct `link_type` / semantics). Import plans may flag **`linkIntent: binding_hint`** when the model infers a structured slot — GM confirms on-card before writing hgArch.

## Related docs

- **`docs/RELATIONSHIP_VOCABULARY.md`** — `link_type` labels and autocomplete direction.
- **`docs/MCP_BINDING_CONTRACT.md`** — tools vs `item_links` vs `patch_item` hgArch.
- **`docs/FOCUS_HTML_VS_HGARCH.md`** — focus HTML vs structured bindings round-trip.
