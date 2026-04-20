# GM vs player world quarantine (audit checklist)

Design rule: **password-gated worlds must not share retrieval, search corpora, or MCP default scopes.** Bindings and associations are modeled **inside** one world first.

## Systems to keep scoped

| Surface | Intent | Primary code / routes |
|--------|--------|------------------------|
| Hybrid search / vault | Respect `spaceId` / `spaceIds` / exclude filters | `vault-retrieval.ts`, `spaces.ts` search helpers |
| Lore Q&A | Same filters as caller (`retrieveLoreSources`) | `lore-engine.ts`, `/api/lore/query` |
| MCP tools | Pass `space_id`; avoid “all spaces” unless explicitly requested | `heartgarden-mcp-server.ts` |
| World sever scripts | Remove cross-world `item_links` when splitting tiers | `heartgarden-sever-player-gm-worlds.ts` |
| Realtime / collab | Presence and polls are per active space | `use-heartgarden-space-change-sync.ts`, presence routes |

## When adding features

1. **Default** to the active space (or explicit id list) for any new list/search/expand API.
2. **Never** merge player-space and GM-space item id sets in one response unless the route is explicitly documented as a privileged admin tool.
3. **Document** any new embedding or index job with the same space filters as the items query that feeds it.

This file is a checklist for human review; pair with `docs/PLAYER_LAYER.md` for boot-context behavior.
