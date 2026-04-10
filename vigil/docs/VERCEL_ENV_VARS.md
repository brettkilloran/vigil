---
title: Vercel environment variables
status: canonical
audience: [agent, human]
last_reviewed: 2026-04-10
canonical: true
related:
  - vigil/docs/DEPLOY_VERCEL.md
  - vigil/docs/PLAYER_LAYER.md
---

# Vercel environment variables — reference

Use with **[`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md)** and the **[dashboard checklist](./DEPLOY_VERCEL_CHECKLIST.md)**. This file is the **source of truth** for env semantics; narrative deploy docs link here instead of duplicating edge cases. Set each key in **Project → Settings → Environment Variables** and choose **Production**, **Preview**, **Development** (or combinations) per cell below.

| Variable | Typical Production | Typical Preview (isolated DB) | Notes |
|----------|-------------------|-------------------------------|--------|
| `NEON_DATABASE_URL` | Yes | Yes (**different** pooled URL than prod) | Required for cloud sync; omit both → demo bootstrap. |
| `ANTHROPIC_API_KEY` | If lore needed | Optional / omit | Server-only. |
| `ANTHROPIC_LORE_MODEL` | Optional | Optional | |
| `OPENAI_API_KEY` | If semantic search / index | Optional / omit | Server-only. |
| `HEARTGARDEN_EMBEDDING_MODEL` | Optional | Optional | |
| `R2_ACCOUNT_ID` | If uploads | If uploads | Full `R2_*` set required together. |
| `R2_ACCESS_KEY_ID` | If uploads | If uploads | |
| `R2_SECRET_ACCESS_KEY` | If uploads | If uploads | Mark **Sensitive**. |
| `R2_BUCKET_NAME` | If uploads | If uploads | |
| `R2_PUBLIC_BASE_URL` | If uploads | If uploads | No trailing slash. |
| `NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE` | Optional | Optional | Client-side **zoom-aware** image URLs for media cards (`{w}` / `{url}` placeholders). See **`.env.local.example`** and **`docs/FEATURES.md`** (Media). |
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

**Do not set:** `PLAYWRIGHT_E2E` (also forces the boot gate **off** in **`/api/heartgarden/boot`** for E2E).

**Usually not needed on Vercel (MCP / local scripts):** `HEARTGARDEN_APP_URL`, `HEARTGARDEN_MCP_WRITE_KEY` — set on the machine running `npm run mcp` when pointing at production. **`HEARTGARDEN_DEFAULT_SPACE_ID`** is optional on Vercel too: if **`HEARTGARDEN_PLAYER_SPACE_ID`** is empty, it can supply the Players space UUID (same format as MCP).

After changes, **Redeploy** so functions pick up new values.
