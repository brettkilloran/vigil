---
title: heartgarden — HTTP API reference
status: canonical
audience: [agent, human]
last_reviewed: 2026-04-11
canonical: true
related:
  - heartgarden/docs/FEATURES.md
  - heartgarden/docs/PLAYER_LAYER.md
  - heartgarden/docs/VERCEL_ENV_VARS.md
---

# heartgarden — HTTP API reference

Hand-maintained catalog of **`app/api/**`** routes. **Auth:** the app is single-user / local-first today; most routes do **not** verify a user session. Exceptions that require secrets are called out.

**Non-HTTP product behavior** (minimap, presence, vault index strip, wiki `[[` assist, culling, etc.) is indexed in **`docs/FEATURES.md`** with pointers into this file where APIs apply.

Conventions: successful JSON often includes `{ ok: true, … }`; errors `{ ok: false, error: string }` (legacy **`/api/v1/*`** uses `{ error: string }` only).

## Client-only editor behavior (not HTTP)

**hgDoc** block reorder (six-dot grip in the focus / document sheet) runs entirely in the browser (`HgDocPointerBlockDrag`). It does **not** call a heartgarden API and is **not** listed in the tables below.

There is **no** supported **`/api/dev/*`** route in this catalog for editor or block-drag diagnostics. Use browser DevTools or ad-hoc logging during development.

## Bootstrap

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/bootstrap` | Active space, spaces list, items (subtree), **`camera`** (see subsection below). **`PLAYWRIGHT_E2E=1`** forces empty demo payload (tests only). With boot gate on, **`middleware`** returns **403** without a valid **`hg_boot`** cookie (except **`/api/heartgarden/boot`**), unless **`Authorization: Bearer`** matches **`HEARTGARDEN_MCP_SERVICE_KEY`**. With a valid **`player`** tier cookie, scopes to the resolved Players root (env UUID if set, else implicit dedicated space; 403 if misconfigured). **`demo`** tier should not call this in normal clients (local canvas only). |

### `camera` in the bootstrap JSON

Responses include **`camera`**: `{ x, y, zoom }` parsed from legacy **`spaces.canvas_state`**. The **shipped heartgarden web shell** does **not** use this value for the initial viewport — it applies **`defaultCamera()`** (world origin centered, zoom 1) and persists pan/zoom in **browser-local storage** per space while you work (`heartgarden-space-camera-v1`; see **`AGENTS.md`** → Canvas camera). Treat **`camera`** as **compatibility / debugging** for API consumers; do not assume it matches first paint in the official UI. The shell does not write viewport back to **`canvas_state`**.

## Boot gate (splash PIN)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/heartgarden/boot` | **`{ gateEnabled, sessionValid, sessionTier, playerLayerMisconfigured? }`** — no secrets. **`sessionTier`** is **`"access"`** (Bishop), **`"player"`**, **`"demo"`**, or **`null`**. Gate is **off** when **`PLAYWRIGHT_E2E=1`**, when **`HEARTGARDEN_BOOT_SESSION_SECRET`** is shorter than **16** characters, or when no PIN is exactly **8** characters (**Bishop**, **Players**, and/or **demo**). Clients may still see legacy **`"visitor"`** until they refresh against a new deploy; treat like **`"player"`**. |
| POST | `/api/heartgarden/boot` | Body **`{ code }`** — exactly **8** characters (after trim); **PIN match is case-insensitive**. On success: **204** + **`Set-Cookie`** `hg_boot` (httpOnly, signed tier **access**, **player**, or **demo**). On failure: **401** with constant **`{ error: "Access denied." }`**. Too many attempts from one client IP: **429** **`{ error: "Too many requests." }`** (in-memory limit per instance; see env below). |
| DELETE | `/api/heartgarden/boot` | Clears **`hg_boot`** (e.g. after in-app **Log out**). **204**. |

**Env:** **`HEARTGARDEN_BOOT_PIN_BISHOP`**, optional **`HEARTGARDEN_BOOT_PIN_PLAYERS`**, optional **`HEARTGARDEN_BOOT_PIN_DEMO`**, **`HEARTGARDEN_BOOT_SESSION_SECRET`**, optional **`HEARTGARDEN_BOOT_SESSION_MAX_AGE_SEC`**, optional **`HEARTGARDEN_PLAYER_SPACE_ID`**, optional **`HEARTGARDEN_GM_ALLOW_PLAYER_SPACE=1`** (GM break-glass). See **`docs/VERCEL_ENV_VARS.md`** and **`docs/PLAYER_LAYER.md`**.

## MCP (Model Context Protocol)

| Method | Path | Purpose |
|--------|------|---------|
| GET, POST, DELETE | `/api/mcp` | **Streamable HTTP** MCP transport (same JSON-RPC surface as **`npm run mcp`** stdio). **Auth (any one):** header **`Authorization: Bearer <HEARTGARDEN_MCP_SERVICE_KEY>`**, or query **`?token=`** / **`?key=`** (same secret), or header **`X-Heartgarden-Mcp-Token`**. Returns **503** if **`HEARTGARDEN_MCP_SERVICE_KEY`** is unset. **401** if none match. Middleware allows this path through the boot gate without **`hg_boot`** so the route can respond; auth is enforced in the handler. Stateless (**no** session stickiness) for serverless. |

**Tooling:** Shared logic lives in **`src/lib/mcp/heartgarden-mcp-server.ts`**.

**Tool names:** **`tools/list`** advertises only **`heartgarden_*`** (e.g. **`heartgarden_search`**, **`heartgarden_patch_item`**). **`tools/call`** still accepts legacy **`vigil_*`** names and maps them to **`heartgarden_*`** via **`canonicalHeartgardenMcpToolName`** (see unit tests in **`heartgarden-mcp-server.test.ts`**).

**Claude Desktop (remote connector):** Add the server under **Settings → Customize → Connectors** (not only `claude_desktop_config.json` for remote URLs). Set **Remote MCP server URL** to **`https://<host>/api/mcp?token=<HEARTGARDEN_MCP_SERVICE_KEY>`** (percent-encode the token if it contains **`&`**, **`+`**, **`#`**, etc.). Remote traffic is brokered from **Anthropic’s cloud**; your deployment must be **public HTTPS** (see Anthropic’s published egress IP ranges). **Do not** use a normal browser tab as the test: address-bar navigation is not an MCP client; use **`npm run mcp:smoke`** (below) or MCP Inspector.

**Vercel Deployment Protection:** If **Vercel Authentication** / SSO / password protection is enabled on the hostname you use, **MCP requests never reach this app** (the edge shows a login wall). **Turn off protection for Production** (or protect Preview only), or use Vercel’s **automation bypass** as an extra **`&x-vercel-protection-bypass=`** query param (see **`docs/DEPLOY_VERCEL.md`** § MCP and Deployment Protection). Claude cannot send **`x-vercel-protection-bypass`** as a header.

**Verify from CLI (recommended):** From **`heartgarden/`**, with the same secret as Production:

`HEARTGARDEN_MCP_SERVICE_KEY=… npm run mcp:smoke`

Optional **`HEARTGARDEN_MCP_URL`** (default `https://heartgarden.vercel.app/api/mcp`) points at **`/api/mcp`**. Optional **`HEARTGARDEN_VERCEL_PROTECTION_BYPASS`** adds Vercel’s **`x-vercel-protection-bypass`** query param for smoke tests against a protected deployment. Uses **`@modelcontextprotocol/sdk`** `StreamableHTTPClientTransport` + **`Client`** — same wire protocol as Claude Desktop. Success prints server info and a tool count; failure usually means wrong key, missing env on the server (**503**), or network.

## Spaces

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/spaces` | List spaces. |
| POST | `/api/spaces` | Create space. **GM:** optional top-level row (`parentSpaceId` omitted) or child of an allowed parent. **Player:** **`parentSpaceId` required** — must be the Players root or a folder space under it (`spaceIsUnderPlayerRoot`); cannot supply **`id`** (no client-chosen UUID). |
| PATCH | `/api/spaces/[spaceId]` | Update **name** and/or **`parentSpaceId`** (UUID or `null`). A **`camera`** field in the body is accepted for backward compatibility but **ignored** (viewport is not persisted server-side). **`parentSpaceId`** is **GM-only** (rejected for **player**); requires access to both this space and the new parent; the server rejects moves that would create a **parent cycle**. Use this to keep a folder’s inner space aligned when its folder card moves between canvases. |
| DELETE | `/api/spaces/[spaceId]` | Delete space (cascade per schema). |
| GET | `/api/spaces/[spaceId]/changes` | Query **`since`** (ISO timestamp). Response includes **`items`** (changed item rows) and **`cursor`** (max of item + space `updated_at` in range). When any subtree **`spaces`** row changed since **`since`** (e.g. folder reparent / rename), **`spaces`** lists **`{ id, name, parentSpaceId, updatedAt }`** so other clients can merge without a full bootstrap. Optional **`includeItemIds=1`**: when set, includes **`itemIds`** (full subtree id list for tombstone sync). When omitted, **`itemIds` is omitted** — the shell sends **`includeItemIds=1`** after navigation or when the tab becomes visible again, then steady-state polls omit it. |
| GET | `/api/spaces/[spaceId]/presence` | Optional **`?except=<clientUuid>`**. Optional **`scope=local`** — restrict to peers whose **`activeSpaceId`** equals **`spaceId`**; **default** (omit param) returns peers in **`spaceId`’s entire subtree** (descendant child spaces included). Each peer: **`clientId`**, **`activeSpaceId`**, **`camera`** `{ x, y, zoom }`, **`pointer`** `{ x, y } \| null` (world coordinates), **`updatedAt`** (ISO). TTL **~2 minutes**. |
| POST | `/api/spaces/[spaceId]/presence` | Body **`{ clientId: uuid, camera: { x, y, zoom }, pointer?: { x, y } \| null }`**. URL **`spaceId`** is the client’s active canvas space (must match access rules). Upserts **one row per `clientId`** in **`canvas_presence`**. Rate-limited **per public IP** (in-memory per server instance). **`PLAYWRIGHT_E2E=1`** bypasses. Deletes stale rows globally (older than server TTL). **`429`** if rate limited. Requires **`canvas_presence`** in Postgres (`npm run db:push` after schema pull). |
| GET | `/api/spaces/[spaceId]/items` | Items for space. |
| POST | `/api/spaces/[spaceId]/items` | Create item in space. |
| GET | `/api/spaces/[spaceId]/graph` | Graph JSON export for space. |
| GET | `/api/spaces/[spaceId]/summary` | Short summary for tooling / MCP. |
| POST | `/api/spaces/[spaceId]/reindex` | Vault reindex for all items in space. **Body:** `{ write_key }` must match **`HEARTGARDEN_MCP_WRITE_KEY`**. Optional `refreshLoreMeta`. Rate-limited. |

## Items

| Method | Path | Purpose |
|--------|------|---------|
| PATCH | `/api/items/[itemId]` | Partial update (geometry, content, entity meta, stack, …). Optional **`baseUpdatedAt`** (ISO) must match the row’s **`updated_at`** or the handler returns **409** **`{ ok: false, error: "conflict", item }`**. Missing item → **404**; the shell drops the entity locally (remote delete). Success returns **`{ ok: true, item }`** (includes **`updatedAt`**). Triggers search blob / optional vault scheduling per implementation. |
| DELETE | `/api/items/[itemId]` | Delete item. |
| POST | `/api/items/[itemId]/embed` | Clear stale `item_embeddings` rows for item (does not embed). |
| POST | `/api/items/[itemId]/index` | Chunk + optional lore meta (Anthropic). Vector rows require a future embedding provider in **`src/lib/embedding-provider.ts`** (none wired). Rate-limited. |
| GET | `/api/items/[itemId]/links` | Link neighbors. |
| GET | `/api/items/[itemId]/related` | Related-items heuristic. |

## Search

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/search` | Query params: `q`, `spaceId`, mode (`hybrid` / `semantic` / FTS), filters (`types`, `entityTypes`, `limit`, …). **Hybrid / semantic** (when embeddings are configured): optional retrieval tuning — `ftsLimit` (8–200), `fuzzyLimitEmpty` / `fuzzyLimitSparse` (8–100), `ftsSparseThreshold` (2–64), `vectorChunkLimit` (8–200), `maxChunksPerItem` (1–12), `retrievalMaxItems` (8–80, caps RRF output; defaults from `limit` or 24). Uses pgvector when embeddings are configured. **Players** tier: `spaceId` forced to player space; hybrid/semantic downgraded to FTS. |
| GET | `/api/search/suggest` | Prefix / palette suggestions. |
| GET | `/api/search/chunks` | Raw chunk-level hits (debug / advanced clients). |

## Lore

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/lore/query` | Body: `question`, optional `spaceId`, `limit`. Needs **`ANTHROPIC_API_KEY`**. In-memory rate limit. If **`HEARTGARDEN_LORE_QUERY_DISABLED=1`**, returns **503**. |

## Lore import

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/lore/import/parse` | Multipart / file → extracted text (and metadata). |
| POST | `/api/lore/import/extract` | JSON/text extraction helper (see route for shape). |
| POST | `/api/lore/import/plan` | **Synchronous** smart plan. Needs **`ANTHROPIC_API_KEY`**. Optional `persistReview`. |
| POST | `/api/lore/import/jobs` | Enqueue **async** plan job; returns `jobId`, `importBatchId`. |
| GET | `/api/lore/import/jobs/[jobId]` | Poll status. **Required query:** `spaceId=<uuid>` (must match job’s space). |
| POST | `/api/lore/import/apply` | Apply a plan to the canvas (see route body). |
| POST | `/api/lore/import/commit` | Persist import / review decisions (see route). |
| POST | `/api/lore/consistency/check` | Lore consistency check (LLM-backed; see route for body). |

## Item links

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/item-links` | Create link. |
| PATCH | `/api/item-links` | Update link. |
| DELETE | `/api/item-links` | Delete link. |
| POST | `/api/item-links/sync` | Replace / sync links from client graph (transactional; see route). |

## Upload & webclip

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/upload/presign` | R2 presigned PUT. Needs **R2_* env** (`r2-upload.ts`). |
| POST | `/api/webclip/preview` | Server fetch preview for webclip URLs (sanitized). |

## v1 (legacy JSON shape)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/items?space_id=` | List items as v1 JSON. |
| GET | `/api/v1/items/[itemId]` | Single item. |

---

## Environment variables (common)

| Variable | Used by |
|----------|---------|
| `NEON_DATABASE_URL` / `DATABASE_URL` | DB |
| `ANTHROPIC_API_KEY` | Lore query, import planning, index lore meta |
| `ANTHROPIC_LORE_MODEL` | Optional model override |
| `HEARTGARDEN_MCP_SERVICE_KEY` | Bearer for **`GET|POST|DELETE /api/mcp`**, stdio MCP internal `fetch` to **`/api/*`** when the boot gate is on, and boot-context GM resolution for those requests |
| `HEARTGARDEN_MCP_WRITE_KEY` | Reindex + MCP write tools (must match client `write_key`) |
| `R2_*` | Image presign |
| `PLAYWRIGHT_E2E` | Bootstrap empty demo (tests only); boot gate forced off in **`/api/heartgarden/boot`** |
| `HEARTGARDEN_BOOT_PIN_BISHOP` / `HEARTGARDEN_BOOT_PIN_PLAYERS` / `HEARTGARDEN_BOOT_PIN_DEMO` | Boot splash PINs (8 chars each if set) |
| `HEARTGARDEN_BOOT_SESSION_SECRET` | Signs **`hg_boot`** session cookie |
| `HEARTGARDEN_BOOT_SESSION_MAX_AGE_SEC` | Optional cookie max-age |
| `HEARTGARDEN_PLAYER_SPACE_ID` | Players-tier scoped space UUID (see **`docs/PLAYER_LAYER.md`**) |
| `HEARTGARDEN_BOOT_POST_RATE_LIMIT_MAX` | Optional max **`POST /api/heartgarden/boot`** attempts per IP per window (default **40**, clamped **3–500**) |
| `HEARTGARDEN_BOOT_POST_RATE_LIMIT_WINDOW_MS` | Optional window length in ms (default **15 minutes**, clamped **30s–1h**) |
| `HEARTGARDEN_PRESENCE_POST_RATE_LIMIT_MAX` | Optional max **`POST …/presence`** per **public IP** per window (default **4000**, clamped **10–100000**). Baseline ~36 posts per **tab** per 15 min from the **25s** heartbeat; **pointer moves** can add throttled POSTs (~one every **2s** while moving). Two household players on one Wi‑Fi ≈ 2× that — still far below default. Raise only for very many devices sharing one IP. |
| `HEARTGARDEN_PRESENCE_POST_RATE_LIMIT_WINDOW_MS` | Optional window in ms (default **15 minutes**, clamped **60s–1h**) |

See also **`docs/DEPLOY_VERCEL.md`**, **`docs/FOLLOW_UP.md`**, and **`AGENTS.md`** for operational detail.

*Living document — add rows when new routes ship.*
