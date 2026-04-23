# GM vs player world quarantine (audit checklist)

Design rule: **password-gated worlds must not share retrieval, search corpora, or MCP default scopes.** Bindings and associations are modeled **inside** one world first.

## Systems to keep scoped

| Surface | Intent | Primary code / routes |
|--------|--------|------------------------|
| Hybrid search / vault | Respect `spaceId` / `spaceIds` / exclude filters | `vault-retrieval.ts`, `spaces.ts` search helpers |
| Lore Q&A | Same filters as caller (`retrieveLoreSources`) | `lore-engine.ts`, `/api/lore/query` |
| MCP tools | Pass `space_id`; avoid “all spaces” unless explicitly requested | `heartgarden-mcp-server.ts` (see **`docs/MCP_BINDING_CONTRACT.md`**) |
| World sever scripts | Remove cross-world `item_links` when splitting tiers | `scripts/sever-player-gm-worlds.ts` |
| Realtime / collab | Presence and polls are per active space | `use-heartgarden-space-change-sync.ts`, presence routes |

## When adding features

1. **Default** to the active space (or explicit id list) for any new list/search/expand API.
2. **Never** merge player-space and GM-space item id sets in one response unless the route is explicitly documented as a privileged admin tool.
3. **Document** any new embedding or index job with the same space filters as the items query that feeds it.

## MCP `all_spaces` (explicit opt-in)

Chunk search and similar tools may accept **`all_spaces`** to scan the entire database. That bypasses normal world quarantine — **only** use when the operator understands cross-world leakage risk (e.g. a dedicated admin aggregation). Default every call to a single `space_id` aligned with the session world.

## Link revision / collab

Link mutations bump **`itemLinksRevision`**; collab clients poll **`GET …/link-revision`** and subscribe to **`item-links.changed`** so multiple editors do not each pull the full graph every tick. See `src/lib/item-links-space-revision.ts` and `use-heartgarden-space-change-sync.ts`.

This file is a checklist for human review; pair with `docs/PLAYER_LAYER.md` for boot-context behavior.
