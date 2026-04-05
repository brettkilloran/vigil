# Vercel environment variables — reference

Use with **[`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md)** and the **[dashboard checklist](./DEPLOY_VERCEL_CHECKLIST.md)**. Set each key in **Project → Settings → Environment Variables** and choose **Production**, **Preview**, **Development** (or combinations) per cell below.

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
| `HEARTGARDEN_LORE_QUERY_DISABLED` | Optional (`1` to harden) | Optional | Disables **`POST /api/lore/query`** only. |
| `HEARTGARDEN_BOOT_PIN_ACCESS` | Optional | Optional | Exactly **8** characters if set; GM tier in the signed cookie. With **`HEARTGARDEN_BOOT_SESSION_SECRET`** (16+ chars), **either** this **or** **`HEARTGARDEN_BOOT_PIN_VISITOR`** (or both) must be 8 chars to enable the boot PIN gate. Sensitive. |
| `HEARTGARDEN_BOOT_PIN_VISITOR` | Optional | Optional | Exactly **8** characters if set; visitor / player tier. Gate enables when this **or** access PIN is 8 chars, plus session secret. Sensitive. |
| `HEARTGARDEN_BOOT_SESSION_SECRET` | If gate used | If gate used | Signs **`hg_boot`** httpOnly cookie. Sensitive; rotate if leaked. |
| `HEARTGARDEN_BOOT_SESSION_MAX_AGE_SEC` | Optional | Optional | Cookie lifetime (default **30 days**); must be **60–31536000** if set. |
| `HEARTGARDEN_BOOT_POST_RATE_LIMIT_MAX` | Optional | Optional | Max **`POST /api/heartgarden/boot`** attempts per IP per window (default **40**; clamped **3–500**). In-memory per server instance. |
| `HEARTGARDEN_BOOT_POST_RATE_LIMIT_WINDOW_MS` | Optional | Optional | Rate-limit window in ms (default **900000** = 15 min; clamped **30000–3600000**). |
| `HEARTGARDEN_PLAYER_SPACE_ID` | If visitor PIN used | If visitor PIN used | UUID of the Neon **space** visitors may use (must exist in DB). Without a valid value, **visitor** sessions get **403** on bootstrap and data routes. Not required for **access**-only gate. |

**Do not set:** `PLAYWRIGHT_E2E` (also forces the boot gate **off** in **`/api/heartgarden/boot`** for E2E).

**Usually not needed on Vercel (MCP / local scripts):** `HEARTGARDEN_APP_URL`, `HEARTGARDEN_DEFAULT_SPACE_ID`, `HEARTGARDEN_MCP_WRITE_KEY` — set on the machine running `npm run mcp` when pointing at production.

After changes, **Redeploy** so functions pick up new values.
