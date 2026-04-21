# MCP contract: canvas connections vs structured card fields

For external agents, avoid overloaded words like “bind” (can clash with committing LLM suggestions). Prefer:

| Intent | Tool / route | Storage |
|--------|----------------|---------|
| **Visible thread** between two cards | `heartgarden_create_link` → `POST /api/item-links` | `item_links` (pins often **null** from MCP; UI supplies default anchors on hydrate) |
| **Structured field** on a lore card (roster, anchors, planned slots) | `heartgarden_patch_item` with `content_json` / **hgArch** | `items.content_json` |

## Canonical relationship vocabulary

Prefer these `link_type` values for canvas threads:

- `pin` (default rope)
- `bond`
- `affiliation`
- `contract`
- `conflict`
- `history`

Legacy values are still accepted by API routes but normalized/aliased by import and UI pipelines. For MCP tools, emit canonical values directly.

## Connection density guardrail

Not every card needs a thread. The world is interconnected, but the canvas should remain readable.

- Prefer **high-signal links**: add a thread only when it changes navigation, retrieval, or decision-making.
- Avoid full-mesh wiring inside a single tightly scoped concept set.
- If many cards belong to one contained idea, use a **folder** (subspace) and connect only key bridges in/out of that cluster.
- Favor one meaningful `link_type` over multiple redundant edges between the same pair.

Practical MCP rule of thumb:

- Use `heartgarden_create_link` for explicit cross-card relationships that should be visible as map wires.
- Use `heartgarden_create_folder` when organizing a dense local concept domain (district, operation, chapter, organization cell) to reduce wire noise and preserve legibility.
- Use `heartgarden_patch_item` / `hgArch` for structured ownership fields instead of adding extra cosmetic threads.

## Null-pin dedup

Canvas threads usually set `source_pin` / `target_pin`; MCP typically omits them. The unique constraint is `(source_item_id, target_item_id, source_pin, target_pin)`, so the **same pair** can have **multiple rows** (different pin geometry vs null pins). For recall and UX, treat these as **one logical association** when slot semantics match; dedup by `(source, target, link_type)` is a product decision, not enforced in DB.

## Quarantine

Default to a **single `space_id`** per tool call. **`all_spaces`** on chunk search is **opt-in** and crosses the whole DB — use only when deliberately aggregating; see **`docs/QUARANTINE_AUDIT.md`**.

## Revision / sync

Link writes publish realtime **`item-links.changed`**. Clients use **`itemLinksRevision`** on `GET …/changes` and `GET …/graph` to avoid downloading the full edge set on every poll.
