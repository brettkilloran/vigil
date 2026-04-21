# Relationship vocabulary (associations & bindings)

This appendix supports **naming**, **import**, **MCP**, and future **autocomplete / autolink** so relationship labels stay consistent as the taxonomy grows.

## Canvas connection labels (`item_links.link_type`)

Canonical options and UI ordering live in **`src/lib/lore-link-types.ts`** (`LORE_LINK_TYPE_OPTIONS`). Values are stored as short strings; unknown values round-trip and display as raw text (`menuLabelForLinkType`).

| Value | Typical use |
|-------|-------------|
| `pin` | User-drawn default thread (not used from bulk import) |
| `reference`, `ally`, `enemy`, `neutral`, `quest`, `lore` | Associative / narrative ties |
| `faction`, `location`, `npc` | Legacy / import **role** tags when the edge adds meaning beyond endpoint entity kinds |
| `other` | Curated list + free nuance via **link label** / notes |

**Shipping new labels:** add an entry to `LORE_LINK_TYPE_OPTIONS` (with group + menu copy). Server accepts any `varchar(64)`; older clients show the raw string.

## Structured bindings (hgArch)

Bindings use **slot ids** from **`src/lib/bindings-catalog.ts`** (`BINDING_SLOT_DEFINITIONS`), not `link_type`. MCP and import should map narrative relationships to **canvas connection** vs **patch_item `content_json.hgArch`** using the catalog and tool copy in **`docs/MCP_BINDING_CONTRACT.md`**.

## Autocomplete / autolink (today vs next)

- **Today:** Cmd+K palette search, wiki `[[` assist, and `vigil:item:` resolution reuse **search** and **known item ids** — see `ArchitecturalLinksPanel` and vault prose expansion (`expandProseLinkedItems`).
- **Next:** A dedicated relationship picker can suggest `LORE_LINK_TYPE_OPTIONS` + binding slot targets from the bindings catalog; keep **one** registry (`lore-link-types` + `bindings-catalog`) as the source of truth.

## Import hints

Import plan links may set **`linkIntent`**: `association` (default) vs `binding_hint` (structured field the GM should confirm on the card). See **`lore-import-plan-llm.ts`** outline rules and **`lore-import-plan-types.ts`**.
