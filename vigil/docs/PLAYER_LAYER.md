# Players layer (Players PIN + scoped space)

When the boot gate is on and the user signs in with the **Players** PIN, the signed httpOnly cookie **`hg_boot`** carries tier **`visitor`** (legacy name in code). Configure the PIN with **`HEARTGARDEN_BOOT_PIN_PLAYERS`** (preferred) or **`HEARTGARDEN_BOOT_PIN_VISITOR`** (fallback if `PLAYERS` is unset or not exactly 8 characters). The app treats this as the **Players layer**: read/write is limited to a single Neon space UUID from **`HEARTGARDEN_PLAYER_SPACE_ID`**. **GM** uses the **`access`** tier (or gate off). With the gate on, **`middleware.ts`** blocks **`/api/*`** until a valid **`hg_boot`** cookie is present (except **`/api/heartgarden/boot`**), so there is no pre-PIN GM API access. **Demo** (`HEARTGARDEN_BOOT_PIN_DEMO`, tier **`demo`**) is local-seeded only and does not use Neon data APIs.

**Break-glass (rare):** set **`HEARTGARDEN_GM_ALLOW_PLAYER_SPACE=1`** so **GM** sessions can list, search (including global/hybrid without excluding the Players space), and use APIs against the Players-only UUID. Default is off so GM tooling never casually sees player notes.

Full detail lives in server helper [`src/lib/heartgarden-api-boot-context.ts`](../src/lib/heartgarden-api-boot-context.ts).

## Invariants (do not regress)

1. **GM path unchanged** — Logic branches must be **`if (visitor)`** / Players only where intended. Never default the app to Players behavior on data routes.
2. **Fail closed** — Missing/invalid **`HEARTGARDEN_PLAYER_SPACE_ID`** or space not in DB → Players get **403** on scoped routes (constant body `{ ok: false, error: "Forbidden." }`). No fallback to “first space”.
3. **Defense in depth** — Bootstrap scoping is UX; every API that uses `spaceId` / `itemId` re-checks tier and resolves ownership from the DB where required.
4. **Flat space (Option A)** — Players may only access items whose **`space_id`** equals **`HEARTGARDEN_PLAYER_SPACE_ID`** exactly (no child-space drill-down).
5. **No recon-by-error** — Denial bodies stay generic. For **Players** (`visitor` tier), missing spaces/items/links return **403** with the same constant JSON as other denials (not **404**), so clients cannot infer whether a UUID exists in another space. **GM** sessions keep normal **404** where applicable.
6. **Same browser, two cookies** — GM machines use **`access`**; do not share the GM PIN on untrusted player devices.
7. **Boot brute-force** — `POST /api/heartgarden/boot` is **rate-limited per IP** (in-memory per server instance; tunable via env). **`PLAYWRIGHT_E2E=1`** disables the limit for CI.

## Collaboration (multiplayer)

- **Viewport:** Pan/zoom is **per browser** (`localStorage` key map `heartgarden-space-camera-v1`), not `spaces.canvas_state`.
- **Remote edits:** The shell **polls** `GET /api/spaces/[spaceId]/changes?since=…` (~8s) and merges rows; deletes sync via the returned **`itemIds`** list. When the tab becomes **visible** again, it **polls immediately** (does not wait for the next interval).
- **Drafts vs remote:** While the **focus overlay** or an **inline card body** has unpersisted text, merges **keep local title/body** but still apply **layout** from the server for that card.
- **Concurrent edits on one card:** PATCH may return **409** if **`baseUpdatedAt`** does not match; the UI queues conflicts and can **Use server version** per item. **Geometry-only** conflicts may **apply the server row** without blocking. **404** on PATCH means the item was deleted elsewhere; the shell removes it locally. There is still **no** Google-Docs-style live merged typing (CRDT/OT would be a separate project).
- **Presence:** Optional **`space_presence`** table + heartbeat routes; status bar shows **“N others here”** when peers are active.

## Client feature matrix (`ArchitecturalCanvasApp`)

When **`isPlayersTier`** (boot loaded, gate on, **`sessionTier === "visitor"`**):

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
2. Reject **`visitor_forbidden`** / **`session_invalid`** with **`heartgardenApiForbiddenJsonResponse()`**.
3. Resolve the resource’s **`space_id`** from the DB before trusting the client; use **`visitorMayAccessSpaceId`** / **`visitorMayAccessItemSpace`**.
4. For **Players** (`visitor` tier), use **`heartgardenMaskNotFoundForVisitor()`** instead of returning **404** for missing rows so errors stay indistinguishable.

## Regression checklist

**GM (access PIN or gate off)**

- [ ] `GET /api/heartgarden/boot` → `sessionTier` is **`access`**, **`demo`**, **`visitor`**, or **`null`** as appropriate; gated deploys require cookie for data APIs.
- [ ] Lore query, import, vault review, reindex, presign, hybrid/semantic search still work when keys/env allow.

**Players (Players PIN + valid `HEARTGARDEN_PLAYER_SPACE_ID`)**

- [ ] `GET /api/heartgarden/boot` → `sessionValid: true`, `sessionTier: "visitor"`.
- [ ] `GET /api/bootstrap` lists **only** the player space and its items.
- [ ] `PATCH /api/items/<id>` for an item in another space → **403**.
- [ ] Random non-existent item UUID → **403** (not **404**) so existence is not leaked.
- [ ] `POST /api/lore/query` (and other lore routes) → **403**.
- [ ] `POST /api/upload/presign` → **403**.
- [ ] UI: no lore/import/vault/graph export entry points.

**Players misconfiguration**

- [ ] Players cookie but missing/invalid player space env → operator alert webhook optional (`HEARTGARDEN_PLAYER_LAYER_ALERT_WEBHOOK_URL`); bootstrap and mutating routes **403** (not GM data); boot screen shows configuration error when flagged.
