# MCP contract: canvas connections vs structured card fields

For external agents, avoid overloaded words like “bind” (can clash with committing LLM suggestions). Prefer:

| Intent | Tool / route | Storage |
|--------|----------------|---------|
| **Visible thread** between two cards | `heartgarden_create_link` → `POST /api/item-links` | `item_links` (pins often **null** from MCP; UI supplies default anchors on hydrate) |
| **Structured field** on a lore card (roster, anchors, planned slots) | `heartgarden_patch_item` with `content_json` / **hgArch** | `items.content_json` |

## Null-pin dedup

Canvas threads usually set `source_pin` / `target_pin`; MCP typically omits them. The unique constraint is `(source_item_id, target_item_id, source_pin, target_pin)`, so the **same pair** can have **multiple rows** (different pin geometry vs null pins). For recall and UX, treat these as **one logical association** when slot semantics match; dedup by `(source, target, link_type)` is a product decision, not enforced in DB.

## Quarantine

Default to a **single `space_id`** per tool call. **`all_spaces`** on chunk search is **opt-in** and crosses the whole DB — use only when deliberately aggregating; see **`docs/QUARANTINE_AUDIT.md`**.

## Revision / sync

Link writes publish realtime **`item-links.changed`**. Clients use **`itemLinksRevision`** on `GET …/changes` and `GET …/graph` to avoid downloading the full edge set on every poll.
