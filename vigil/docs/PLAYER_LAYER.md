# Players layer (Players PIN + `HEARTGARDEN_PLAYER_SPACE_ID`)

## What `HEARTGARDEN_PLAYER_SPACE_ID` is and why it is an env var

Heartgarden stores canvas data in Neon: each **space** is a row (with a UUID). Items belong to a **`space_id`**.

- **Bishop** (`HEARTGARDEN_BOOT_PIN_BISHOP`) signs in as cookie tier **`access`** — full GM: all spaces the app would normally list, subject to optional hiding of the player space from GM lists (see break-glass below).
- **Players** (`HEARTGARDEN_BOOT_PIN_PLAYERS`) signs in as cookie tier **`player`**. The server must know **which single space** those sessions are allowed to use. That UUID is **`HEARTGARDEN_PLAYER_SPACE_ID`**.

It is an **environment variable** so the binding is **server-side only**: the browser never receives “try this space id”; the operator sets it once per deploy (e.g. Vercel), and every API route enforces it after reading the signed **`hg_boot`** cookie. Storing it in the DB or in client config would weaken that guarantee or complicate bootstrapping.

**What value to put there:** the **`id`** of the Neon **`spaces`** row that should be the Players canvas (the “composite” world you expose to non-Bishop, non-demo users). You can copy it from GM tooling, SQL, or after creating the space in-app while logged in as Bishop. It must be a **canonical UUID** string (same format as other space ids in the API).

**Demo** (`HEARTGARDEN_BOOT_PIN_DEMO`, tier **`demo`**) uses a **local-seeded** canvas only and does not use this env var for Neon.

**Legacy cookies:** older deployments may still have tier **`visitor`** in the signed payload; verification **normalizes** that to **`player`**.

## Break-glass (rare)

Set **`HEARTGARDEN_GM_ALLOW_PLAYER_SPACE=1`** so **GM** sessions can list, search (including global/hybrid without excluding the Players space), and use APIs against the Players-only UUID. Default is off so GM tooling never casually sees player notes.

Full detail lives in server helper [`src/lib/heartgarden-api-boot-context.ts`](../src/lib/heartgarden-api-boot-context.ts).

## Invariants (do not regress)

1. **GM path unchanged** — Logic branches must be **`if (player)`** / Players only where intended. Never default the app to Players behavior on data routes.
2. **Fail closed** — Missing/invalid **`HEARTGARDEN_PLAYER_SPACE_ID`** or space not in DB → Players get **403** on scoped routes (constant body `{ ok: false, error: "Forbidden." }`). No fallback to “first space”.
3. **Defense in depth** — Bootstrap scoping is UX; every API that uses `spaceId` / `itemId` re-checks tier and resolves ownership from the DB where required.
4. **Flat space (Option A)** — Players may only access items whose **`space_id`** equals **`HEARTGARDEN_PLAYER_SPACE_ID`** exactly (no child-space drill-down).
5. **No recon-by-error** — Denial bodies stay generic. For **Players** (`player` tier), missing spaces/items/links return **403** with the same constant JSON as other denials (not **404**), so clients cannot infer whether a UUID exists in another space. **GM** sessions keep normal **404** where applicable.
6. **Same browser, two cookies** — Bishop machines use **`access`**; do not share the Bishop PIN on untrusted player devices.
7. **Boot brute-force** — `POST /api/heartgarden/boot` is **rate-limited per IP** (in-memory per server instance; tunable via env). **`PLAYWRIGHT_E2E=1`** disables the limit for CI.

## Collaboration (multiplayer)

- **Viewport:** Pan/zoom is **per browser** (`localStorage` key map `heartgarden-space-camera-v1`), not `spaces.canvas_state`.
- **Remote edits:** The shell **polls** `GET /api/spaces/[spaceId]/changes?since=…` on an interval defined with presence timing in [`src/lib/heartgarden-collab-constants.ts`](../src/lib/heartgarden-collab-constants.ts) (8s changes poll, 25s presence heartbeat POST, **4s** presence peer list GET, optional throttled pointer POSTs ~every **2s** while the pointer moves, 120s server presence TTL). Responses can include **`spaces`** rows updated since **`since`** (e.g. folder reparent) so peers merge **`parentSpaceId`** / name without reloading bootstrap. Steady-state polls omit the heavy **`itemIds`** list; **`includeItemIds=1`** is sent after **space navigation** and when the tab becomes **visible** again so remote deletes can reconcile. **Timers pause while the tab is hidden**; when the tab becomes **visible** again, it **polls immediately** (does not wait for the next interval).
- **Drafts vs remote:** While the **focus overlay** or an **inline card body** has unpersisted text, merges **keep local title/body** but still apply **layout** from the server for that card. The protected-id set is built by **`buildCollabMergeProtectedContentIds`** (`src/lib/heartgarden-space-change-sync-utils.ts`) and used inside **`useHeartgardenSpaceChangeSync`**.
- **Concurrent edits on one card:** PATCH may return **409** if **`baseUpdatedAt`** does not match; the UI queues conflicts and can **Use server version** per item. **Geometry-only** conflicts may **apply the server row** without blocking. **404** on PATCH means the item was deleted elsewhere; the shell removes it locally. There is still **no** Google-Docs-style live merged typing (CRDT/OT would be a separate project).
- **Presence:** Optional **`canvas_presence`** table + heartbeat routes; status bar shows **collaborator emoji chips** (subtree of the current space by default) and **remote cursors** on the shared canvas when pointers are reported. **Follow** (chip click) applies the peer’s last **camera** and switches **active space** if needed; a **confirm** runs if a focus sheet, gallery, or stack modal is open. The server rate-limits POSTs **by the client’s public IP**. **Two (or more) players in one household on the same Wi‑Fi** share that single IP — defaults stay well above a few tabs. Very large groups on one network can raise **`HEARTGARDEN_PRESENCE_POST_RATE_LIMIT_*`** — see [`docs/API.md`](./API.md) and [`docs/VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md).

## Client feature matrix (`ArchitecturalCanvasApp`)

When **`isPlayersTier`** (boot loaded, gate on, **`sessionTier === "player"`**):

| Surface | Players |
|---------|---------|
| Notes, checklists, code cards | On |
| Folders, new child spaces, media cards | Off (API + UI) |
| Rich-text image insert in dock | Off |
| Cmd/Ctrl+4, 5 (media / folder hotkeys) | No-op |
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
- [ ] `POST /api/lore/query` (and other lore routes) → **403**.
- [ ] `POST /api/upload/presign` → **403**.
- [ ] UI: no lore/import/vault/graph export entry points.

**Players misconfiguration**

- [ ] Players cookie but missing/invalid player space env → operator alert webhook optional (`HEARTGARDEN_PLAYER_LAYER_ALERT_WEBHOOK_URL`); bootstrap and mutating routes **403** (not GM data); boot screen shows configuration error when flagged.
