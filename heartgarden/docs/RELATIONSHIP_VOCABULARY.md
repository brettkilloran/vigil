# Relationship vocabulary (associations & bindings)

This appendix supports **naming**, **import**, **MCP**, and future **autocomplete / autolink** so relationship labels stay consistent as the taxonomy grows.

## Canvas connection labels (`item_links.link_type`)

Canonical options and UI ordering live in **`src/lib/lore-link-types.ts`** (`LORE_LINK_TYPE_OPTIONS`). Values are stored as short strings; legacy aliases normalize forward to canonical values.

| Value | Typical use |
|-------|-------------|
| `pin` | User-drawn default thread |
| `bond` | Trusted personal tie (coven, partner, sworn ally) |
| `affiliation` | Membership/alignment with an organization, bloc, nation, or cult |
| `contract` | Formal work/mission/paid obligation |
| `conflict` | Active opposition, hostile pressure, coercion |
| `history` | Former ties and shared past still shaping current events |

Legacy aliases are normalized at write/import time:

- `reference` -> `history`
- `ally` -> `bond`
- `enemy` -> `conflict`
- `neutral` -> `pin`
- `quest` -> `contract`
- `lore` -> `history`
- `other` -> `history`
- `faction` -> `affiliation`
- `location` -> `history`
- `npc` -> `bond`
- `leverage` -> `conflict`

`anomaly` semantics are metadata/label-level (not a first-class `link_type`).

## Sparsity and containment policy

Connection threads are semantic highlights, not mandatory wiring.

- Do **not** connect everything that is merely related in-world.
- Add links when they improve retrieval, traversal, or player-facing reasoning.
- Keep local clusters readable: if a set is densely interrelated, prefer a **folder** boundary plus a few bridge links.
- Within one pair of cards, prefer one strongest relationship type rather than multiple redundant threads.

This policy keeps the canvas legible and preserves signal quality for LLM retrieval and generation.

**Shipping new labels:** update `LORE_LINK_TYPE_OPTIONS` and the canonical table in `src/lib/connection-kind-colors.ts` together.

## Structured bindings (hgArch)

Bindings use **slot ids** from **`src/lib/bindings-catalog.ts`** (`BINDING_SLOT_DEFINITIONS`), not `link_type`. MCP and import should map narrative relationships to **canvas connection** vs **patch_item `content_json.hgArch`** using the catalog and tool copy in **`docs/MCP_BINDING_CONTRACT.md`**.

## Autocomplete / autolink (today vs next)

- **Today:** Cmd+K palette search, wiki `[[` assist, and `vigil:item:` resolution reuse **search** and **known item ids** — see `ArchitecturalLinksPanel` and vault prose expansion (`expandProseLinkedItems`).
- **Next:** A dedicated relationship picker can suggest `LORE_LINK_TYPE_OPTIONS` + binding slot targets from the bindings catalog; keep **one** registry (`lore-link-types` + `bindings-catalog`) as the source of truth.

## Import hints

Import plan links may set **`linkIntent`**: `association` (default) vs `binding_hint` (structured field the GM should confirm on the card). Import normalization aliases legacy strings to the canonical set and falls back to `history` when uncertain.
