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

**Do not set:** `PLAYWRIGHT_E2E`.

**Usually not needed on Vercel (MCP / local scripts):** `HEARTGARDEN_APP_URL`, `HEARTGARDEN_DEFAULT_SPACE_ID`, `HEARTGARDEN_MCP_WRITE_KEY` — set on the machine running `npm run mcp` when pointing at production.

After changes, **Redeploy** so functions pick up new values.
