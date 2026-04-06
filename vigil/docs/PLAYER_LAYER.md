# Players layer (Players PIN + optional `HEARTGARDEN_PLAYER_SPACE_ID`)

## What `HEARTGARDEN_PLAYER_SPACE_ID` is (optional)

Heartgarden stores canvas data in Neon: each **space** is a row (with a UUID). Items belong to a **`space_id`**.

- **Bishop** (`HEARTGARDEN_BOOT_PIN_BISHOP`) signs in as cookie tier **`access`** — full GM: all spaces the app would normally list, subject to optional hiding of the player space from GM lists (see break-glass below).
- **Players** (`HEARTGARDEN_BOOT_PIN_PLAYERS`) signs in as cookie tier **`player`**. The server allows **exactly one** Neon space for those sessions. If **`HEARTGARDEN_PLAYER_SPACE_ID`** (or **`HEARTGARDEN_DEFAULT_SPACE_ID`**) is set to a valid UUID, that row is used. If both are **unset**, the server uses a **dedicated implicit Players root** space (created on first Players session if needed), **not** Bishop’s default GM workspace — so GM and Players never share canvas data by accident. Set the env var when you want a specific UUID, or to **hide** that space from GM lists while using an explicit id (see below).

Optional second source: **`HEARTGARDEN_DEFAULT_SPACE_ID`** (MCP convention) is used only when **`HEARTGARDEN_PLAYER_SPACE_ID`** is empty.

**What value to put in `HEARTGARDEN_PLAYER_SPACE_ID`:** the **`id`** of the Neon **`spaces`** row that should be the Players canvas (optional if you accept the auto-created implicit root). It must be a **canonical UUID** string (same format as other space ids in the API).

**Demo** (`HEARTGARDEN_BOOT_PIN_DEMO`, tier **`demo`**) uses a **local-seeded** canvas only and does not use this env var for Neon.

**Legacy cookies:** older deployments may still have tier **`visitor`** in the signed payload; verification **normalizes** that to **`player`**.

## Break-glass (rare)

Set **`HEARTGARDEN_GM_ALLOW_PLAYER_SPACE=1`** so **GM** sessions can list, search (including global/hybrid without excluding the Players space), and use APIs against the Players-only UUID. Default is off so GM tooling never casually sees player notes.

Full detail lives in server helper [`src/lib/heartgarden-api-boot-context.ts`](../src/lib/heartgarden-api-boot-context.ts).

## Severing GM and player data in Neon (one-time cleanup)

If Bishop and Players ever shared a space (legacy behavior) or you need to guarantee **no** `item_links` edges between the GM world and the player world:

1. From **`vigil/`**, preview impact:  
   `HEARTGARDEN_SEVER_WORLDS_DRY=1 npm run db:sever-worlds`
2. Destructive run (deletes all **items** and **folder spaces** under player roots, removes **cross-world** links; keeps implicit / env root **space rows** empty):  
   `HEARTGARDEN_SEVER_WORLDS_CONFIRM=1 npm run db:sever-worlds`

The script uses the same env as the app (`.env.local` + `HEARTGARDEN_PLAYER_SPACE_ID` / `HEARTGARDEN_DEFAULT_SPACE_ID`). It targets the union of subtrees rooted at every `__heartgarden_player_root__` row and at the resolved env UUID. **Do not** point `HEARTGARDEN_DEFAULT_SPACE_ID` at a GM workspace UUID unless you intend to wipe that space’s items. Implementation: [`src/lib/heartgarden-sever-player-gm-worlds.ts`](../src/lib/heartgarden-sever-player-gm-worlds.ts).

## Invariants (do not regress)

1. **GM path unchanged** — Logic branches must be **`if (player)`** / Players only where intended. Never default the app to Players behavior on data routes.
2. **Fail closed** — **Invalid** (non-empty but not UUID) **`HEARTGARDEN_PLAYER_SPACE_ID`** / **`HEARTGARDEN_DEFAULT_SPACE_ID`**, missing Neon DB when Players need a resolved space, or space not in DB → Players get **403** on scoped routes (constant body `{ ok: false, error: "Forbidden." }`). When env is empty, the server resolves the implicit Players root space from Neon (not client-controlled, never the GM default workspace).
3. **Defense in depth** — Bootstrap scoping is UX; every API that uses `spaceId` / `itemId` re-checks tier and resolves ownership from the DB where required.
4. **Subtree (folders)** — Players may access items in the **resolved player root space** and in **child folder spaces** under it (`spaceIsUnderPlayerRoot`). Same rules apply to **`item_links`** (pin threads): `POST` / `PATCH` / `DELETE` `/api/item-links` and `GET /api/spaces/[spaceId]/graph` use `playerMayAccessItemSpaceAsync` / `requireHeartgardenSpaceApiAccess` so threads persist like GM, scoped to the player world.
5. **No recon-by-error** — Denial bodies stay generic. For **Players** (`player` tier), missing spaces/items/links return **403** with the same constant JSON as other denials (not **404**), so clients cannot infer whether a UUID exists in another space. **GM** sessions keep normal **404** where applicable.
6. **Same browser, two cookies** — Bishop machines use **`access`**; do not share the Bishop PIN on untrusted player devices.
7. **Boot brute-force** — `POST /api/heartgarden/boot` is **rate-limited per IP** (in-memory per server instance; tunable via env). **`PLAYWRIGHT_E2E=1`** disables the limit for CI.

## Collaboration (multiplayer)

- **Viewport:** Pan/zoom is **per browser** (`localStorage` key map `heartgarden-space-camera-v1`), not `spaces.canvas_state`.
- **Remote edits:** The shell **polls** `GET /api/spaces/[spaceId]/changes?since=…` on an interval from [`src/lib/heartgarden-collab-constants.ts`](../src/lib/heartgarden-collab-constants.ts): **~2.2s** when another client has **presence** in the space, **~5.5s** when alone (fewer Neon round-trips). Presence heartbeat POST **25s**, peer list GET **3s**, optional throttled pointer POSTs ~every **2s** while the pointer moves, **120s** server presence TTL. Responses can include **`spaces`** rows updated since **`since`** (e.g. folder reparent) so peers merge **`parentSpaceId`** / name without reloading bootstrap. Steady-state polls omit the heavy **`itemIds`** list; **`includeItemIds=1`** is sent after **space navigation** and when the tab becomes **visible** again so remote deletes can reconcile. **Timers pause while the tab is hidden**; when the tab becomes **visible** again, it **polls immediately** (does not wait for the next interval).
- **Drafts vs remote:** While the **focus overlay** or an **inline card body** has unpersisted text, merges **keep local title/body** but still apply **layout** from the server for that card. The protected-id set is built by **`buildCollabMergeProtectedContentIds`** (`src/lib/heartgarden-space-change-sync-utils.ts`) and used inside **`useHeartgardenSpaceChangeSync`**.
- **Concurrent edits on one card:** PATCH may return **409** if **`baseUpdatedAt`** does not match; the UI queues conflicts and can **Use server version** per item. **Geometry-only** conflicts may **apply the server row** without blocking. **404** on PATCH means the item was deleted elsewhere; the shell removes it locally. There is still **no** Google-Docs-style live merged typing (CRDT/OT would be a separate project).
- **Presence:** Optional **`canvas_presence`** table + heartbeat routes; status bar shows **collaborator emoji chips** (subtree of the current space by default) and **remote cursors** on the shared canvas when pointers are reported. **Follow** (chip click) applies the peer’s last **camera** and switches **active space** if needed; a **confirm** runs if a focus sheet, gallery, or stack modal is open. The server rate-limits POSTs **by the client’s public IP**. **Two (or more) players in one household on the same Wi‑Fi** share that single IP — defaults stay well above a few tabs. Very large groups on one network can raise **`HEARTGARDEN_PRESENCE_POST_RATE_LIMIT_*`** — see [`docs/API.md`](./API.md) and [`docs/VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md).

## Client feature matrix (`ArchitecturalCanvasApp`)

When **`isPlayersTier`** (boot loaded, gate on, **`sessionTier === "player"`**):

| Surface | Players |
|---------|---------|
| Notes, checklists, code cards, folders (child spaces) | On |
| Media cards, webclip | Off (API + UI) |
| Rich-text image insert in dock | Off |
| Cmd/Ctrl+4 (media hotkey) | No-op |
| Cmd/Ctrl+5 (folder) | On |
| Palette: Ask lore, link graph, import, vault review, export JSON | Hidden |
| Top bar: import, vault review | Hidden |
| Lore panels, smart import, link graph overlay | Unmounted |
| Search palette (lexical / FTS) | On (server forces player `spaceId`) |
| Links panel (same-space item links) | On if enabled for cloud |

## New routes (maintainer checklist)

Any new **`app/api/**`** handler that reads **`spaceId`**, **`itemId`**, or link rows must:

1. Call **`getHeartgardenApiBootContext()`** (or parse cookies the same way).
2. Reject **`player_forbidden`** / **`session_invalid`** with **`heartgardenApiForbiddenJsonResponse()`**.
3. Resolve the resource’s **`space_id`** from the DB before trusting the client; use **`playerMayAccessSpaceId`** / **`playerMayAccessItemSpace`**.
4. For **Players** (`player` tier), use **`heartgardenMaskNotFoundForPlayer()`** instead of returning **404** for missing rows so errors stay indistinguishable.

## Regression checklist

**GM (Bishop PIN or gate off)**

- [ ] `GET /api/heartgarden/boot` → `sessionTier` is **`access`**, **`demo`**, **`player`**, or **`null`** as appropriate; gated deploys require cookie for data APIs.
- [ ] Lore query, import, vault review, reindex, presign, hybrid/semantic search still work when keys/env allow.

**Players (Players PIN + valid `HEARTGARDEN_PLAYER_SPACE_ID`)**

- [ ] `GET /api/heartgarden/boot` → `sessionValid: true`, `sessionTier: "player"`.
- [ ] `GET /api/bootstrap` lists **only** the player space and its items.
- [ ] `PATCH /api/items/<id>` for an item in another space → **403**.
- [ ] Random non-existent item UUID → **403** (not **404**) so existence is not leaked.
- [ ] `POST /api/item-links` between two items in the player subtree → **200**; refresh / `GET …/graph` shows the edge.
- [ ] `POST /api/spaces` with `{ name, parentSpaceId }` where parent is the player root or a folder under it → **200**; `POST …/items` with `itemType: "folder"` → **200**; dock / palette / **5** create folder.
- [ ] `POST /api/lore/query` (and other lore routes) → **403**.
- [ ] `POST /api/upload/presign` → **403**.
- [ ] UI: no lore/import/vault/graph export entry points.

**Players misconfiguration**

- [ ] Players cookie but **invalid** (non-empty, bad UUID) player/default space env → operator alert webhook optional (`HEARTGARDEN_PLAYER_LAYER_ALERT_WEBHOOK_URL`); bootstrap and mutating routes **403** (not GM data); boot screen shows configuration error when flagged. Empty env with valid Neon is **not** misconfigured.
