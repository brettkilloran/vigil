---
title: Vercel environment variables
status: canonical
audience: [agent, human]
last_reviewed: 2026-04-21
canonical: true
related:
  - heartgarden/docs/DEPLOY_VERCEL.md
  - heartgarden/docs/PLAYER_LAYER.md
---

# Vercel environment variables — reference

Use with **[`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md)** and the **[dashboard checklist](./DEPLOY_VERCEL_CHECKLIST.md)**. This file is the **source of truth** for env semantics; narrative deploy docs link here instead of duplicating edge cases. Set each key in **Project → Settings → Environment Variables** and choose **Production**, **Preview**, **Development** (or combinations) per cell below.

**Role in the deploy set:** use this to answer "what does this variable mean?" or "which environments should get it?" Do **not** use it as the first deploy walkthrough.

**Need a different deploy doc?**

- **First deploy order / narrative:** [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md)
- **Dashboard clicks:** [`DEPLOY_VERCEL_CHECKLIST.md`](./DEPLOY_VERCEL_CHECKLIST.md)
- **Neon Production + Preview setup:** [`NEON_VERCEL_SETUP.md`](./NEON_VERCEL_SETUP.md)
- **Go-live follow-up:** [`GO_LIVE_REMAINING.md`](./GO_LIVE_REMAINING.md)

| Variable | Typical Production | Typical Preview (isolated DB) | Notes |
|----------|-------------------|-------------------------------|--------|
| `NEON_DATABASE_URL` | Yes | Yes (**different** pooled URL than prod) | Required for cloud sync; omit both → demo bootstrap. |
| `ANTHROPIC_API_KEY` | If lore needed | Optional / omit | Server-only. |
| `ANTHROPIC_LORE_MODEL` | Optional | Optional | |
| `HEARTGARDEN_ANTHROPIC_TIMEOUT_MS` | Optional | Optional | Max time (ms) for user-facing Anthropic calls (notably lore query). Default **120000**; clamped **5000–600000**. |
| `HEARTGARDEN_ANTHROPIC_JOB_TIMEOUT_MS` | Optional | Optional | Max time (ms) for job/import Anthropic calls (outline/merge/clarify/extract/meta/consistency). Default **300000**; clamped **5000–600000**. |
| `HEARTGARDEN_ANTHROPIC_CACHE_DISABLED` | Optional | Optional | Set **`1`** to disable Anthropic prompt caching globally (wrapper removes `cache_control`). |
| `HEARTGARDEN_ANTHROPIC_CACHE_TTL` | Optional | Optional | Prompt-cache TTL for cached system blocks: **`5m`** (default) or **`1h`**. `1h` increases cache-write cost; use only when repeated reads justify it. |
| `HEARTGARDEN_ANTHROPIC_DEBUG` | Optional | Optional | Set **`1`** to log structured Anthropic wrapper telemetry (`stop_reason`, token usage including cache create/read, retries, continuations, elapsed ms). Preferred name. |
| `HEARTGARDEN_ANTHROPIC_CACHE_DEBUG` | Optional | Optional | Back-compat alias for `HEARTGARDEN_ANTHROPIC_DEBUG` (same behavior). |
| `HEARTGARDEN_ANTHROPIC_THINKING_BUDGET` | Optional | Optional | Extended-thinking budget tokens for reasoning-heavy labels (`lore.query.answer`, `lore.import.clarify`, `lore.consistency`). Default **8192**. |
| `HEARTGARDEN_ANTHROPIC_THINKING_DISABLED` | Optional | Optional | Set **`1`** to force-disable extended thinking for all Anthropic calls. |
| `HEARTGARDEN_ANTHROPIC_MAX_OUTPUT_TOKENS` | Optional | Optional | Global override for Anthropic wrapper output ceiling (`max_tokens`). Per-label defaults are set in code; this override applies to all labels. |
| `HEARTGARDEN_ANTHROPIC_MAX_CONTINUATIONS` | Optional | Optional | Max auto-continue turns when Anthropic returns `stop_reason: max_tokens`. Default **3** (clamped **0–12**). |
| `HEARTGARDEN_ANTHROPIC_MAX_RETRIES` | Optional | Optional | Max retry attempts for transient Anthropic failures (429/529/network). Default **3** (clamped **0–8**). |
| `HEARTGARDEN_ANTHROPIC_METRICS_SAMPLE_RATE` | Optional | Optional | Sample rate `0..1` for production-safe AI telemetry logs (`[anthropic-metric]` + `[lore-query-metric]`). Keep low (for example `0.01` or `0.05`). |
| `OPENAI_API_KEY` | If vector vault / semantic search | Optional | Server-only. When set, **`src/lib/embedding-provider.ts`** indexes **`item_embeddings`** (default model **`text-embedding-3-small`**, 1536-d). Without it, hybrid search is lexical-only. |
| `HEARTGARDEN_OPENAI_EMBEDDING_MODEL` | Optional | Optional | Override OpenAI embedding model (default **`text-embedding-3-small`**). |
| `HEARTGARDEN_LORE_META_IGNORE_SOURCE_HASH` | Omit | Optional | Set **`1`** to **always** run Anthropic on vault reindex when lore meta is enabled (ignores stored `lore_meta_source_hash`). Use after changing the lore model or to force-refresh summaries. |
| `HEARTGARDEN_INDEX_AFTER_PATCH` | Optional | Optional | Server `after()` owner for item reindex on PATCH/create. **Default on**; set **`0`** to disable and rely on other index triggers. |
| `HEARTGARDEN_INDEX_SKIP_LORE_META` | Optional | Optional | Set **`1`** to skip Anthropic lore summary/alias refresh on all reindex paths (still chunks/embeddings). |
| `NEXT_PUBLIC_HEARTGARDEN_INDEX_OWNER` | Optional | Optional | Client/server index owner policy. Default **`server_after`** disables client debounced `POST /api/items/:id/index`. |
| `HEARTGARDEN_VAULT_DEBUG` | Omit | Optional | Set **`1`** to emit server `console.debug` hybrid retrieval diagnostics (query preview + RRF top ranks). |
| `R2_ACCOUNT_ID` | If uploads | If uploads | Full `R2_*` set required together. |
| `R2_ACCESS_KEY_ID` | If uploads | If uploads | |
| `R2_SECRET_ACCESS_KEY` | If uploads | If uploads | Mark **Sensitive**. |
| `R2_BUCKET_NAME` | If uploads | If uploads | |
| `R2_PUBLIC_BASE_URL` | If uploads | If uploads | No trailing slash. |
| `NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE` | Optional | Optional | Client-side **zoom-aware** image URLs for media cards (`{w}` / `{url}` placeholders). See **`.env.local.example`** and **`docs/FEATURES.md`** (Media). |
| `NEXT_PUBLIC_HEARTGARDEN_SYNC_DEBUG` | Omit | Optional | Set to **`1`** in **Preview / local** only: browser **`console.debug`** for each item **PATCH** (latency, status, `baseUpdatedAt`). No server behavior. See **`docs/API.md`** (browser shell — PATCH versioning). |
| `HEARTGARDEN_LORE_QUERY_DISABLED` | Optional (`1` to harden) | Optional | Disables **`POST /api/lore/query`** only. |
| `HEARTGARDEN_BOOT_PIN_BISHOP` | Optional | Optional | Exactly **8** characters if set; GM tier (**`access`**) in the signed cookie. With **`HEARTGARDEN_BOOT_SESSION_SECRET`** (16+ chars), at least one of Bishop / Players / demo PIN must be 8 chars to enable the gate. Sensitive. |
| `HEARTGARDEN_BOOT_PIN_PLAYERS` | Optional | Optional | Players PIN (**8** chars). Cookie tier **`player`**. If **`HEARTGARDEN_PLAYER_SPACE_ID`** / **`HEARTGARDEN_DEFAULT_SPACE_ID`** are non-empty, they must be valid UUIDs. If both are unset, Players use a dedicated implicit Neon root space (not Bishop’s GM workspace; see **`docs/PLAYER_LAYER.md`**). Sensitive. **`HEARTGARDEN_BOOT_PIN_PLAYER`** (singular) is also read as an alias if `…_PLAYERS` is unset — prefer the plural name in new setups. |
| `HEARTGARDEN_BOOT_PIN_DEMO` | Optional | Optional | **8** chars; demo tier, local-only canvas. Sensitive. |
| `HEARTGARDEN_GM_ALLOW_PLAYER_SPACE` | Omit | Omit | Set **`1`** only for recovery: GM may access the Players-only space in lists, search, and item APIs. |
| `HEARTGARDEN_BOOT_SESSION_SECRET` | If gate used | If gate used | Signs **`hg_boot`** httpOnly cookie. Sensitive; rotate if leaked. |
| `HEARTGARDEN_BOOT_SESSION_MAX_AGE_SEC` | Optional | Optional | Cookie lifetime (default **30 days**); must be **60–31536000** if set. |
| `HEARTGARDEN_BOOT_POST_RATE_LIMIT_MAX` | Optional | Optional | Max **`POST /api/heartgarden/boot`** attempts per IP per window (default **40**; clamped **3–500**). In-memory per server instance. |
| `HEARTGARDEN_BOOT_POST_RATE_LIMIT_WINDOW_MS` | Optional | Optional | Rate-limit window in ms (default **900000** = 15 min; clamped **30000–3600000**). |
| `HEARTGARDEN_PRESENCE_POST_RATE_LIMIT_MAX` | Optional | Optional | Max **`POST /api/spaces/[id]/presence`** per **public IP** per window (default **4000**; clamped **10–100000**). **Roommates / family on the same home Wi‑Fi** share one IP — the default is already safe for that; raise only for unusually many devices on one network (see **`docs/PLAYER_LAYER.md`**). In-memory per server instance. |
| `HEARTGARDEN_PRESENCE_POST_RATE_LIMIT_WINDOW_MS` | Optional | Optional | Presence rate-limit window in ms (default **900000** = 15 min; clamped **60000–3600000**). |
| `HEARTGARDEN_PLAYER_SPACE_ID` | Optional with Players PIN | Optional with Players PIN | When set: UUID of the Neon **`spaces`** row for the Players canvas (must exist in DB). When unset with Players PIN: server uses an auto-created implicit Players root (isolated from GM). Use this to pick a **specific** UUID or to **hide** that space from GM lists. See **`docs/PLAYER_LAYER.md`**. Not required for Bishop-only gate. |
| `HEARTGARDEN_MCP_SERVICE_KEY` | If using **`/api/mcp`** or MCP clients against prod APIs | Same | Long random Bearer secret. Enables **Streamable HTTP** MCP at **`GET|POST|DELETE /api/mcp`**, allows **`Authorization: Bearer`** through the boot gate for **`/api/*`**, and lets **`pnpm run mcp`** (stdio) call **`fetch`** to the deployed app when the PIN gate is on. Mark **Sensitive**. |
| `HEARTGARDEN_MCP_ALLOW_QUERY_TOKEN` | Omit | Optional | Set **`1`** to allow MCP auth via URL query (`?token=` / `?key=`). Default is header-only auth (Bearer or `X-Heartgarden-Mcp-Token`) to reduce URL secret leakage in logs/history. |
| `HEARTGARDEN_MCP_WRITE_KEY` | If using MCP write tools / reindex API | Same | Must match **`write_key`** in **`heartgarden_patch_item`**, **`heartgarden_create_item`**, **`heartgarden_create_folder`**, **`heartgarden_create_link`**, and **`POST /api/spaces/:id/reindex`**. Sensitive. |
| `HEARTGARDEN_MCP_READ_ONLY` | Optional | Optional | Set **`1`** to force MCP server read-only mode (write tools return an explicit disabled error). |
| `HEARTGARDEN_MCP_FETCH_TIMEOUT_MS` | Optional | Optional | Default MCP HTTP fetch timeout (ms) for tool proxy calls. Clamped **1000–300000** (default **30000**). |
| `HEARTGARDEN_MCP_LORE_QUERY_TIMEOUT_MS` | Optional | Optional | Override timeout (ms) specifically for MCP `heartgarden_lore_query` calls. Clamped **1000–300000**. Defaults to max(`HEARTGARDEN_MCP_FETCH_TIMEOUT_MS`, lore query AI timeout). |
| `HEARTGARDEN_REALTIME_URL` | If multiplayer realtime on | Same | Public **WebSocket base URL** returned by **`POST /api/realtime/room-token`** (browser opens **`${url}?token=…`**). From HTTPS pages use **`wss://`** (e.g. `wss://realtime.example.com`) — never plain **`ws://`** against a production **https://** app (mixed content). No trailing path; server path is `/`. |
| `HEARTGARDEN_REALTIME_REDIS_URL` | If realtime on | Same | Redis **pub/sub** URL (e.g. Upstash). Must be reachable from **Vercel serverless** (writes publish) and from the **realtime server** process. Mark **Sensitive**. |
| `HEARTGARDEN_REALTIME_SECRET` | If realtime on | Same | Shared secret **≥ 16** characters: signs room tokens (**Next**) and verifies them (**`pnpm run realtime`**). Same value on Vercel and the realtime host. Mark **Sensitive**. |
| `HEARTGARDEN_REALTIME_DEBUG` | Omit | Optional | Set **`1`** to emit extra realtime publish metric logs outside development. |
| `HEARTGARDEN_REALTIME_PORT` | Only on realtime host | N/A on Vercel | Listen port for **`scripts/realtime-server.ts`** (default **3002**). Not set on Vercel unless you run a local hybrid. |
| `HEARTGARDEN_ENABLE_DEV_ROUTES` | Omit | Optional | Set **`1`** to expose `/dev/*` pages in production-like environments; default keeps them hidden in production. |
| `HEARTGARDEN_DEV_GM_SPACE_ID` | Omit | Optional | Development-only override for default GM space id in server helpers (UUID expected). |
| `HEARTGARDEN_PLAYER_LAYER_ALERT_WEBHOOK_URL` | Optional | Optional | Optional webhook endpoint for player-layer misconfiguration alerts (rate-limited server POSTs). |
| `HEARTGARDEN_DEBUG_ERRORS` | Omit | Optional | Set **`1`** to expose extra error detail in selected API responses intended for debugging. |
| `HEARTGARDEN_IMPORT_JOBS_LEGACY_SCHEMA_FALLBACK` | Omit | Optional | Temporary compatibility escape hatch for `POST /api/lore/import/jobs`: set **`1`** to allow legacy insert fallback when progress columns are missing. Default is **off**; preferred fix is running migrations. |

**Realtime:** Vercel does **not** run the WebSocket server by default. Set the three **`HEARTGARDEN_REALTIME_*`** vars on **Vercel**, provision **Redis**, and deploy **`pnpm run realtime`** to a **separate** long-lived host (VM, Fly, Railway, etc.) with TLS termination so **`HEARTGARDEN_REALTIME_URL`** is **`wss://`**. See **`docs/DEPLOY_VERCEL.md`** §5.5.

**Do not set:** `PLAYWRIGHT_E2E` (also forces the boot gate **off** in **`/api/heartgarden/boot`** for E2E).

**MCP env:** For **local** stdio only against **`next dev`**, you can omit **`HEARTGARDEN_MCP_SERVICE_KEY`** (boot gate is off by default). For **production** or **`HEARTGARDEN_DEV_ENFORCE_BOOT_GATE=1`**, set **`HEARTGARDEN_MCP_SERVICE_KEY`** on the server **and** in the environment of **`pnpm run mcp`** so tool **`fetch`** calls include **`Authorization: Bearer`**. Optional: **`HEARTGARDEN_APP_URL`**, **`HEARTGARDEN_DEFAULT_SPACE_ID`** on the machine running **`pnpm run mcp`** when not using same-origin defaults.

**Vercel Deployment Protection:** Not an app env var — if **SSO / password protection** blocks the **hostname** you use for MCP, **Anthropic’s broker cannot reach `/api/mcp`**. Fix in **Vercel → Deployment Protection** (see **`docs/DEPLOY_VERCEL.md`** § MCP and Deployment Protection).

After changes, **Redeploy** so functions pick up new values.
