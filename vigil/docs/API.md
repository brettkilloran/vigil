# heartgarden — HTTP API reference

Hand-maintained catalog of **`app/api/**`** routes. **Auth:** the app is single-user / local-first today; most routes do **not** verify a user session. Exceptions that require secrets are called out.

Conventions: successful JSON often includes `{ ok: true, … }`; errors `{ ok: false, error: string }` (legacy **`/api/v1/*`** uses `{ error: string }` only).

## Bootstrap

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/bootstrap` | Active space, spaces list, items (subtree), camera. **`PLAYWRIGHT_E2E=1`** forces empty demo payload (tests only). |

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
| GET | `/api/search` | Query params: `q`, `spaceId`, mode (`hybrid` / `semantic` / FTS), filters. Uses pgvector when configured. |
| GET | `/api/search/suggest` | Prefix / palette suggestions. |
| GET | `/api/search/chunks` | Raw chunk-level hits (debug / advanced clients). |

## Lore

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/lore/query` | Body: `question`, optional `spaceId`, `limit`. Needs **`ANTHROPIC_API_KEY`**. In-memory rate limit. |

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
| `PLAYWRIGHT_E2E` | Bootstrap empty demo (tests only) |

See also **`docs/DEPLOY_VERCEL.md`**, **`docs/FOLLOW_UP.md`**, and **`AGENTS.md`** for operational detail.

*Living document — add rows when new routes ship.*
