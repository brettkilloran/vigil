# heartgarden — HTTP API reference

Hand-maintained catalog of **`app/api/**`** routes. **Auth:** the app is single-user / local-first today; most routes do **not** verify a user session. Exceptions that require secrets are called out.

Conventions: successful JSON often includes `{ ok: true, … }`; errors `{ ok: false, error: string }` (legacy **`/api/v1/*`** uses `{ error: string }` only).

## Bootstrap

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/bootstrap` | Active space, spaces list, items (subtree), camera. **`PLAYWRIGHT_E2E=1`** forces empty demo payload (tests only). With boot gate on and a valid **`visitor`** `hg_boot` cookie, scopes to **`HEARTGARDEN_PLAYER_SPACE_ID`** only (403 if misconfigured). |

## Boot gate (splash PIN)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/heartgarden/boot` | **`{ gateEnabled, sessionValid, sessionTier }`** — no secrets. **`sessionTier`** is **`"access"`**, **`"visitor"`**, or **`null`** (invalid cookie, gate off, or not yet signed in). Gate is **off** when **`PLAYWRIGHT_E2E=1`**, when **`HEARTGARDEN_BOOT_SESSION_SECRET`** is shorter than **16** characters, or when **neither** PIN is exactly **8** characters (**`HEARTGARDEN_BOOT_PIN_ACCESS`** and/or **`HEARTGARDEN_BOOT_PIN_VISITOR`** — either one is enough to turn the gate on). |
| POST | `/api/heartgarden/boot` | Body **`{ code }`** — exactly **8** characters (after trim). On success: **204** + **`Set-Cookie`** `hg_boot` (httpOnly, signed tier **access** or **visitor**). On failure: **401** with constant **`{ error: "Access denied." }`**. Too many attempts from one client IP: **429** **`{ error: "Too many requests." }`** (in-memory limit per instance; see env below). |
| DELETE | `/api/heartgarden/boot` | Clears **`hg_boot`** (e.g. after in-app **Log out**). **204**. |

**Env:** **`HEARTGARDEN_BOOT_PIN_ACCESS`**, optional **`HEARTGARDEN_BOOT_PIN_VISITOR`**, **`HEARTGARDEN_BOOT_SESSION_SECRET`**, optional **`HEARTGARDEN_BOOT_SESSION_MAX_AGE_SEC`**, optional **`HEARTGARDEN_PLAYER_SPACE_ID`** (UUID of the campaign/table space for **visitor** tier; required for a working visitor session). See **`docs/VERCEL_ENV_VARS.md`** and **`docs/PLAYER_LAYER.md`**.

## Spaces

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/spaces` | List spaces. |
| POST | `/api/spaces` | Create space. |
| PATCH | `/api/spaces/[spaceId]` | Update name and/or camera `{ x, y, zoom }`. |
| DELETE | `/api/spaces/[spaceId]` | Delete space (cascade per schema). |
| GET | `/api/spaces/[spaceId]/items` | Items for space. |
| POST | `/api/spaces/[spaceId]/items` | Create item in space. |
| GET | `/api/spaces/[spaceId]/graph` | Graph JSON export for space. |
| GET | `/api/spaces/[spaceId]/summary` | Short summary for tooling / MCP. |
| POST | `/api/spaces/[spaceId]/reindex` | Vault reindex for all items in space. **Body:** `{ write_key }` must match **`HEARTGARDEN_MCP_WRITE_KEY`**. Optional `refreshLoreMeta`. Rate-limited. |

## Items

| Method | Path | Purpose |
|--------|------|---------|
| PATCH | `/api/items/[itemId]` | Partial update (geometry, content, entity meta, stack, …). Triggers search blob / optional vault scheduling per implementation. |
| DELETE | `/api/items/[itemId]` | Delete item. |
| POST | `/api/items/[itemId]/embed` | Clear stale `item_embeddings` rows for item (does not embed). |
| POST | `/api/items/[itemId]/index` | Chunk + embed + optional lore meta. Needs **`OPENAI_API_KEY`** for vectors; lore meta may use Anthropic. Rate-limited. |
| GET | `/api/items/[itemId]/links` | Link neighbors. |
| GET | `/api/items/[itemId]/related` | Related-items heuristic. |

## Search

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/search` | Query params: `q`, `spaceId`, mode (`hybrid` / `semantic` / FTS), filters. Uses pgvector when configured. **Visitor** tier: `spaceId` forced to player space; hybrid/semantic downgraded to FTS. |
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
| `OPENAI_API_KEY` | Embeddings / semantic search |
| `HEARTGARDEN_MCP_WRITE_KEY` | Reindex + MCP write tools (must match client `write_key`) |
| `R2_*` | Image presign |
| `PLAYWRIGHT_E2E` | Bootstrap empty demo (tests only); boot gate forced off in **`/api/heartgarden/boot`** |
| `HEARTGARDEN_BOOT_PIN_ACCESS` / `HEARTGARDEN_BOOT_PIN_VISITOR` | Boot splash PINs (8 chars each if set) |
| `HEARTGARDEN_BOOT_SESSION_SECRET` | Signs **`hg_boot`** session cookie |
| `HEARTGARDEN_BOOT_SESSION_MAX_AGE_SEC` | Optional cookie max-age |
| `HEARTGARDEN_PLAYER_SPACE_ID` | Visitor-tier scoped space UUID (see **`docs/PLAYER_LAYER.md`**) |
| `HEARTGARDEN_BOOT_POST_RATE_LIMIT_MAX` | Optional max **`POST /api/heartgarden/boot`** attempts per IP per window (default **40**, clamped **3–500**) |
| `HEARTGARDEN_BOOT_POST_RATE_LIMIT_WINDOW_MS` | Optional window length in ms (default **15 minutes**, clamped **30s–1h**) |

See also **`docs/DEPLOY_VERCEL.md`**, **`docs/FOLLOW_UP.md`**, and **`AGENTS.md`** for operational detail.

*Living document — add rows when new routes ship.*
