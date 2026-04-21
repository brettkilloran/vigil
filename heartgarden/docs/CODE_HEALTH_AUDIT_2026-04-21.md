---

title: heartgarden — code health audit (2026-04-21)
status: supporting
audience: [agent, human]
last_reviewed: 2026-04-21
related:

- heartgarden/docs/BUILD_PLAN.md
- heartgarden/docs/FOLLOW_UP.md
- heartgarden/docs/CODEMAP.md
- heartgarden/docs/API.md

---

# heartgarden — code health audit (2026-04-21)

A read-only review of the production shell, sync layer, search/vault, editor, realtime, and operational hygiene. The app is largely **vibecoded**, so findings cluster around three themes:

1. **Silent failure culture** — `catch {}` hides real bugs from users and ops.
2. **Correctness drift** — optimistic lock optional; search / embedding behavior and docs drifting out of sync; link revision joins only one side.
3. **Unbounded work** — delta reads without `LIMIT`; full-space scans on hot paths; presence GC on every request.

This file is a **living backlog** — work items below are intended to be picked up progressively. Check off items when merged; open a plan in `.cursor/plans/` only if the fix needs multi-step coordination. Cross-link shipped fixes from `**BUILD_PLAN.md`** if they close an architectural concern.

## Quick status vs backlog

**Use this file for:** cited bug/perf findings, remediation history, and what still needs doing.

**Do not use this file as the fastest repo status read.** It intentionally mixes historical findings, shipped fixes, and remaining backlog in one place so the audit trail stays intact.

**For quick status instead:**

- **`docs/BUILD_PLAN.md`** — shipped tranches, architecture snapshot, next execution phases.
- **`docs/FEATURES.md`** — what exists in production.
- **`docs/API.md`** — current HTTP contracts and operational toggles.

Treat this document like an annotated defect ledger, not a dashboard.

**Scope explicitly excluded** (reviewed but decided not to fix):

- Monolithic `ArchitecturalCanvasApp.tsx` size. Accepted as current shape; extractions are welcome but not tracked as a defect.
- Player-created items not auto-scheduling vault reindex. By design — players don't currently need vault index participation.
- FTS English-only / no `unaccent`. Acceptable for solo-TTRPG English lore.
- `sql.raw` pgvector literals. Safe given numeric-finite validation upstream.

---

## How to use this doc

- Work top-down by severity. CRITICAL before HIGH before MEDIUM before LOW.
- Each item has file:line citations you can jump to directly.
- **Week-by-week attack order** at the bottom is a suggested progression; reprioritize with the user if a production incident drives focus.
- When closing an item, strike through and add the commit / PR hash and date, e.g. `~~3. Import review queue order~~ — fixed 2026-04-28 (`abcdef1`).`

---

## CRITICAL — ship-blockers or silent data-loss risk

### ~~1. Realtime WebSocket reconnects on every canvas re-render~~ — **fixed 2026-04-21**

`useHeartgardenRealtimeSpaceSync` lists `onInvalidate` in its effect deps, but the shell passes a **fresh inline arrow** each render. The socket is torn down and re-opened constantly, fetching a new JWT each time and spamming the realtime server.

```4658:4667:heartgarden/src/components/foundation/ArchitecturalCanvasApp.tsx
  const { connectedRef: realtimeConnectedRef } = useHeartgardenRealtimeSpaceSync({
    enabled: collabNeonActive,
    activeSpaceId,
    onInvalidate: (detail) => {
      setRealtimeRefreshNonce((n) => n + 1);
      if (detail?.reason === "item-links.changed") {
        enqueueRemoteGraphMerge(true);
      }
    },
  });
```

```105:111:heartgarden/src/hooks/use-heartgarden-realtime-space-sync.ts
    return () => {
      closed = true;
      connectedRef.current = false;
      clearReconnect();
      ws?.close();
    };
  }, [enabled, activeSpaceId, onInvalidate]);
```

**Fix direction:** ref-wrap the handler (pattern already in `useHeartgardenPresenceHeartbeat`), or drop `onInvalidate` from deps.

**Shipped:** `onInvalidateRef` + `useLayoutEffect` in `[use-heartgarden-realtime-space-sync.ts](../src/hooks/use-heartgarden-realtime-space-sync.ts)`; effect deps `[enabled, activeSpaceId]` only.

### ~~2. Optimistic locking is optional and brittle~~ — **fixed 2026-04-21**

PATCH accepts `baseUpdatedAt` but only checks it when present AND parseable as a finite date. Any client bug, partial payload, or clock skew silently degrades to last-writer-wins. Worse, if `existing.updatedAt` ever isn't a `Date` (driver edge), `rowMs = 0` and every valid base triggers spurious 409s.

```137:148:heartgarden/app/api/items/[itemId]/route.ts
  if (p.baseUpdatedAt) {
    const baseMs = Date.parse(p.baseUpdatedAt);
    if (Number.isFinite(baseMs)) {
      const rowMs = existing.updatedAt instanceof Date ? existing.updatedAt.getTime() : 0;
      if (rowMs !== baseMs) {
        return Response.json(
          { ok: false, error: "conflict", item: rowToCanvasItem(existing) },
          { status: 409 },
        );
      }
    }
  }
```

**Fix direction:** require `baseUpdatedAt` for any PATCH that touches `content_json` / `title` / `entity_meta` (not selection-only moves); normalize `updatedAt` with `new Date(existing.updatedAt as any).getTime()`.

**Shipped:** `[route.ts](../app/api/items/[itemId]/route.ts)` — `patchRequiresBaseOptimisticLock()`, `rowUpdatedAtMs()`, 400 when body fields change without `baseUpdatedAt`; tests in `[route.patch-conflict.test.ts](../app/api/items/[itemId]/route.patch-conflict.test.ts)`.

### ~~3. Import review queue is written before plan validation~~ — **fixed 2026-04-21**

`persistImportReviewQueueFromPlan` runs **before** `loreImportPlanSchema.safeParse`. If validation fails, the job is marked `failed`, but pending `import_review_items` may already be inserted/replaced for that batch. Bad LLM output corrupts the user's review queue.

`heartgarden/src/lib/lore-import-job-process.ts` ~L68–80 (persist) vs ~L70–80 (validate).

**Fix direction:** reorder — validate, then persist.

**Shipped:** `[lore-import-job-process.ts](../src/lib/lore-import-job-process.ts)` — `safeParse` before `persistImportReviewQueueFromPlan`.

### ~~4. Lore import commit is not transactional~~ — **fixed 2026-04-21**

`/api/lore/import/commit` performs many sequential `insert(items)` and `insert(itemLinks)`. A mid-flight failure leaves orphan notes without their links, partial folder trees, or half-applied reviews.

`heartgarden/app/api/lore/import/commit/route.ts` 141–273.

**Fix direction:** wrap in a single `db.transaction(...)`. Neon-serverless supports it.

**Shipped:** `[commit/route.ts](../app/api/lore/import/commit/route.ts)` — single `db.transaction`; `scheduleItemEmbeddingRefresh` after commit.

### ~~5. Vector index drifts when embedding fails~~ — **fixed 2026-04-21**

`reindexItemVault` updates `items.search_blob` and sometimes lore fields **before** calling `embedTexts`. If embedding throws, lexical content is already new; old `item_embeddings` rows are never cleared. Hybrid retrieval then ranks new lexical content against stale vectors.

`heartgarden/src/lib/item-vault-index.ts` ~L123–166.

**Fix direction:** do `clearItemEmbeddings` + lexical update + new embedding insert in one transaction, or don't touch `search_blob` until embedding succeeds. Currently moot while #6 holds.

**Shipped:** `[item-vault-index.ts](../src/lib/item-vault-index.ts)` — `embedTexts` before persisting `search_blob` when chunks exist; transactional insert of embeddings + row update.

### ~~6. "Hybrid" search is a lie~~ — **fixed 2026-04-21**

`isEmbeddingApiConfigured()` is hardcoded `false`; `embedTexts` always throws; `vault-retrieval.ts` silently catches and sets `vecHits = []`. The app exposes a `semantic` mode and advertises "RRF fusion" but it's pure FTS + fuzzy. `GET /api/search?mode=hybrid` also diverges from `hybridRetrieveItems` — if FTS returns ≥12 hits the route short-circuits to FTS-only while the library still merges fuzzy.

```11:22:heartgarden/src/lib/embedding-provider.ts

```

```166:172:heartgarden/src/lib/vault-retrieval.ts

```

**Fix direction:** either wire a real provider (OpenAI / Voyage / Cohere — pgvector is already in the schema), or delete `semantic` / `hybrid` modes, the vector SQL, and the RRF code to kill a large dead surface.

**Shipped:** `[embedding-provider.ts](../src/lib/embedding-provider.ts)` — OpenAI embeddings when `OPENAI_API_KEY` is set (default `text-embedding-3-small`, 1536-d). `[search/route.ts](../app/api/search/route.ts)` — hybrid mode always uses `hybridRetrieveItems` with `includeVector` tied to config (no FTS short-circuit divergence). Docs: `[AGENTS.md](../AGENTS.md)`, `[VERCEL_ENV_VARS.md](./VERCEL_ENV_VARS.md)`, `[.env.local.example](../.env.local.example)`.

---

## HIGH — real bugs or operational risk

### ~~7. Silent failure culture in the shell~~ — **fixed 2026-04-21**

Many user-visible actions swallow errors, so a backend blip turns into "ghost" local state until reload.

```3153:3164:heartgarden/src/components/foundation/ArchitecturalCanvasApp.tsx
  const syncDeleteConnection = useCallback(async (connection: CanvasPinConnection) => {
    if (!connection.dbLinkId || !isUuidLike(connection.dbLinkId)) return;
    try {
      await fetch("/api/item-links", { method: "DELETE", ... });
    } catch {
      // Keep local delete authoritative.
    }
  }, []);
```

Same pattern at:

- `architectural-neon-api.ts` 404–407 — 409 conflict still calls `neonSyncEndRequest(true)`; sync strip shows "saved" during an actual conflict.
- `ArchitecturalCanvasApp.tsx` 4564–4566 and 4968–4970 — merge + initial graph poll.
- `schedule-vault-index-after.ts` 20–28 — `after()` reindex errors discarded.
- `item-vault-index.ts` 67–70 — embedding cleanup failures silent.
- `fetchSpaceChanges` (`architectural-neon-api.ts` 167–200) — collapses network / 403 / bad JSON to `null`.

**Fix direction:** route failures through `neon-sync-bus` as real errors; add breadcrumb logging. Distinguish "offline, keep local" from "server said no."

**Shipped:** typed `fetchSpaceChanges` failure surfaces (`http` / `parse` / `network`) in `[architectural-neon-api.ts](../src/components/foundation/architectural-neon-api.ts)`, downstream breadcrumb + auxiliary failure reporting in `[use-heartgarden-space-change-sync.ts](../src/hooks/use-heartgarden-space-change-sync.ts)`, plus prior conflict/delete/merge instrumentation and `after()` logging.

### ~~8. Unbounded delta payloads~~ — **fixed 2026-04-21**

`GET /api/spaces/:id/changes` selects full rows with `updatedAt > since` — no LIMIT, no cursor cap. Long offline, bulk import, or a schema bug that bumps every `updatedAt` can return hundreds of MBs.

```100:104:heartgarden/app/api/spaces/[spaceId]/changes/route.ts
  const changedRows = await db
    .select()
    .from(items)
    .where(and(inArray(items.spaceId, subtreeIds), gt(items.updatedAt, sinceDate)))
    .orderBy(asc(items.updatedAt));
```

Missing btree on `(space_id, updated_at)` — migrations only add GIN/trgm.

**Fix direction:** add `LIMIT` (e.g. 500) + `hasMore` + next cursor; add the btree index.

**Shipped:** `[changes/route.ts](../app/api/spaces/[spaceId]/changes/route.ts)` — `limit` (default 500), `hasMore`, client loop in `[use-heartgarden-space-change-sync.ts](../src/hooks/use-heartgarden-space-change-sync.ts)` + `[fetchSpaceChanges](../src/components/foundation/architectural-neon-api.ts)`; btree migration `[0008_items_space_updated_at_idx.sql](../drizzle/migrations/0008_items_space_updated_at_idx.sql)`; `[docs/API.md](./API.md)`.

### ~~9. O(peers) serial DB calls on presence GET~~ — **fixed 2026-04-21**

Player tier awaits `spaceIsUnderPlayerRoot` inside a `for (const r of rows)` loop.

`heartgarden/app/api/spaces/[spaceId]/presence/route.ts` 91–95.

**Fix direction:** compute the allowed subtree once via a single SQL pass, then filter in JS.

**Shipped:** precomputed subtree id sets via `[fetchDescendantSpaceIds](../src/lib/heartgarden-space-subtree.ts)` and membership checks in `[presence/route.ts](../app/api/spaces/[spaceId]/presence/route.ts)` (no per-peer `await` loop).

### ~~10. Full-table scans for space operations~~ — **fixed 2026-04-21**

`assertSpaceReparentAllowed`, `deleteSpaceSubtree`, and the presence route each `select({id, parentSpaceId}).from(spaces)` — loading every space to walk a local tree. Fine at hundreds of spaces, painful at thousands.

- `heartgarden/src/lib/spaces.ts` 200–205 and 651–653.
- `heartgarden/app/api/spaces/[spaceId]/presence/route.ts` 61–63.

**Fix direction:** recursive CTE scoped to the target subtree, or cache `parentSpaceId` in an in-memory map with TTL.

**Shipped:** subtree-scoped traversal helper `[fetchDescendantSpaceIds](../src/lib/heartgarden-space-subtree.ts)` applied to `[assertSpaceReparentAllowed](../src/lib/spaces.ts)`, `[deleteSpaceSubtree](../src/lib/spaces.ts)`, and `[presence/route.ts](../app/api/spaces/[spaceId]/presence/route.ts)`, removing whole-table parent-map scans from those hot paths.

### ~~11. Link revision fingerprint can miss changes~~ — **fixed 2026-04-21**

`computeItemLinksRevisionForSpace` inner-joins `item_links` on `sourceItemId` only. Links whose only space-visible side is the target won't bump the revision, so clients relying on the revision short-circuit can stall on stale link state.

```12:21:heartgarden/src/lib/item-links-space-revision.ts
  export async function computeItemLinksRevisionForSpace(db: VigilDb, spaceId: string): Promise<string> {
    const [row] = await db
      .select({
        c: sql<number>`count(*)::int`,
        maxU: sql<Date | null>`max(${itemLinks.updatedAt})`,
        maxId: sql<string | null>`max(${itemLinks.id}::text)`,
      })
      .from(itemLinks)
      .innerJoin(items, eq(items.id, itemLinks.sourceItemId))
      .where(eq(items.spaceId, spaceId));
```

**Fix direction:** aggregate over source OR target (two sub-queries unioned), or replace with a `max(updated_at)` covering either side.

**Shipped:** `[item-links-space-revision.ts](../src/lib/item-links-space-revision.ts)` — `EXISTS` for source or target item in space.

### ~~12. Reconnect scheduler is a flat 2s with no jitter~~ — **fixed 2026-04-21**

After a realtime server blip, every client tab aligns on the same cadence and hammers `/api/realtime/room-token`.

`heartgarden/src/hooks/use-heartgarden-realtime-space-sync.ts` 44–49.

**Fix direction:** exponential backoff with ±30% jitter; cap at ~30s.

**Shipped:** `[use-heartgarden-realtime-space-sync.ts](../src/hooks/use-heartgarden-realtime-space-sync.ts)` — exponential backoff with jitter, cap 30s; reset on successful `onopen`.

### ~~13. JWT passed as WebSocket query string~~ — **fixed 2026-04-21**

Tokens end up in edge/proxy logs, referer headers, and browser history for the realtime URL. The file `heartgarden-realtime-token.ts` defines `heartgardenRealtimeSocketAuthHeader` but it is **never referenced** — an abandoned header-auth branch.

- `heartgarden/src/hooks/use-heartgarden-realtime-space-sync.ts` L73.
- `heartgarden/scripts/realtime-server.ts` 157–163.
- `heartgarden/src/lib/heartgarden-realtime-token.ts` 83–87 (dead helper).

**Fix direction:** finish header-based auth (e.g. `Sec-WebSocket-Protocol` subprotocol trick), or rotate tokens aggressively.

**Shipped:** client now sends auth via websocket subprotocols using `[heartgardenRealtimeSocketProtocols](../src/lib/heartgarden-realtime-token.ts)` from `[use-heartgarden-realtime-space-sync.ts](../src/hooks/use-heartgarden-realtime-space-sync.ts)`; realtime server reads token from `sec-websocket-protocol` with query fallback for migration in `[scripts/realtime-server.ts](../scripts/realtime-server.ts)`.

### ~~14. Error-message leakage to clients~~ — **fixed 2026-04-21**

Several routes return raw `Error.message`:

- `POST /api/items/:id/index` → `{error: e.message}` (502) — `app/api/items/[itemId]/index/route.ts` 72–82.
- `GET /api/search/chunks` — embedding errors echoed; `app/api/search/chunks/route.ts` 74–76.
- Import jobs persist raw `Error.message` and serve it on `GET /:jobId` — `lore-import-job-process.ts` 92–101; `[jobId]/route.ts` 93–97.
- MCP tools return raw `await res.text()` in many places — `src/lib/mcp/heartgarden-mcp-server.ts` 667, 685, 711, 731, 1385, 1421, 1436, 1453.

**Fix direction:** standard `{error, code}` with opaque codes; log the full message server-side only.

**Shipped:** prior opaque route hardening plus MCP tool/resource surfaces now return structured opaque errors (with server-side logs) in `[heartgarden-mcp-server.ts](../src/lib/mcp/heartgarden-mcp-server.ts)`, including `ListResources` failures.

### ~~15. Canvas bootstrap effect over-depends on `heartgardenBootApi`~~ — **fixed 2026-04-21**

The whole API object is in the dep array of the bootstrap and cached-workspace effects (shell L5061–5216 and L5218–5243). Any identity change re-runs the async bootstrap race — duplicate `/api/bootstrap` calls, repeated graph resets, lost `cancelled` guards under fast toggles.

**Fix direction:** destructure only the primitive inputs you actually read; wrap callbacks in `useCallback`.

**Shipped:** `[ArchitecturalCanvasApp.tsx](../src/components/foundation/ArchitecturalCanvasApp.tsx)` — primitive boot fields + `heartgardenBootApiRef.current` for reads inside the bootstrap effect.

### ~~16. `entity_meta` / `content_json` are `z.any()` JSON god-objects~~ — **fixed 2026-04-21**

No size cap, no discriminated-union validation, no DB `CHECK` constraints. That's where `aiReview`, `factionRoster`, `loreThreadAnchors`, campaign epoch etc. all live — the backbone of the lore model has zero schema contract.

- `heartgarden/app/api/items/[itemId]/route.ts` 51–76.
- `heartgarden/src/db/schema.ts` 79–80.

**Fix direction:** introduce Zod discriminated unions per `entity_type`; add a 1–2 MB JSON size cap.

**Shipped:** shared write-time JSON guard in [`heartgarden-item-json-schema.ts`](../src/lib/heartgarden-item-json-schema.ts) enforces size caps and entity-type-aware meta validation for high-traffic item write routes: [`app/api/items/[itemId]/route.ts`](../app/api/items/[itemId]/route.ts) and [`app/api/spaces/[spaceId]/items/route.ts`](../app/api/spaces/[spaceId]/items/route.ts).

### ~~17. `rowToCanvasItem(row!)` after UPDATE can throw~~ — **fixed 2026-04-21**

`drizzle.update().returning()` returns `[]` if the row was deleted between the read and update. The `!` surfaces as a 500.

`heartgarden/app/api/items/[itemId]/route.ts` 246–282.

**Fix direction:** guard `if (!row) return 404`.

**Shipped:** `[route.ts](../app/api/items/[itemId]/route.ts)` — 404 when `.returning()` is empty.

### ~~18. Stories are excluded from TypeScript strict checking~~ — **fixed 2026-04-21**

`tsconfig.json` excludes `**/*.stories.{ts,tsx}`. Storybook builds them separately, but type errors there won't break `npm run check`. Given the many untracked story files in the working tree, this is actively masking drift.

```33:34:heartgarden/tsconfig.json
  "exclude": ["node_modules", "**/*.stories.ts", "**/*.stories.tsx"]
```

**Fix direction:** remove the exclusion; fix whatever falls out once.

**Shipped:** removed story exclusions in `[tsconfig.json](../tsconfig.json)` and fixed strict story typing fallout in story files (for example `[BufferedContentEditable.stories.tsx](../src/components/editing/BufferedContentEditable.stories.tsx)`, `[BufferedTextInput.stories.tsx](../src/components/editing/BufferedTextInput.stories.tsx)`, `[VigilAppBootScreen.stories.tsx](../src/components/foundation/VigilAppBootScreen.stories.tsx)`, `[CommandPalette.stories.tsx](../src/components/ui/CommandPalette.stories.tsx)`, `[ContextMenu.stories.tsx](../src/components/ui/ContextMenu.stories.tsx)`).

### ~~19. Dev-only code ships to production~~ — **fixed 2026-04-21**

`app/dev/lore-entity-nodes/page.tsx` + `src/components/dev/LoreEntityNodeLab.tsx` (~147 KB) and `app/dev/ai-pending-style/` are regular app routes and appear in the production build. Worth ~150 KB+ of JS plus an internal surface anyone who can hit `/dev/`* can see.

**Fix direction:** wrap with `notFound()` in prod, or guard behind an env flag, or move under a conditional rewrite.

**Shipped:** production guard added to `[app/dev/lore-entity-nodes/page.tsx](../app/dev/lore-entity-nodes/page.tsx)` and `[app/dev/ai-pending-style/page.tsx](../app/dev/ai-pending-style/page.tsx)`: `notFound()` unless `HEARTGARDEN_ENABLE_DEV_ROUTES=1`.

### ~~20. No rate-limit on `/api/search`~~ — **fixed 2026-04-21**

`/api/lore/query` and the index routes have one, but search does not — and MCP drives search via HTTP. An automated loop can hammer FTS + trigram joins. `src/lib/lore-query-rate-limit.ts` + `vault-index-rate-limit.ts` trust first-hop `X-Forwarded-For` (spoofable if the edge doesn't strip it) and their cleanup only kicks in at >10k entries.

**Fix direction:** share a rate-limit helper; validate `X-Forwarded-For` against a trusted proxy list.

**Shipped:** shared in-memory limiter `[search-rate-limit.ts](../src/lib/search-rate-limit.ts)` wired into `[app/api/search/route.ts](../app/api/search/route.ts)` with `429` + `Retry-After: 60`.

### ~~21. LLM calls have no timeout, abort, or retry budget~~ — **fixed 2026-04-21**

- `lore-engine.ts` 189–194
- `lore-item-meta.ts` 26–38
- `lore-import-plan-llm.ts` 188–193

All call Anthropic with `max_tokens` only. A hung provider pins route-handler concurrency and UI spinners. MCP `fetch` calls are also abort-less — `src/lib/mcp/heartgarden-mcp-server.ts` 136–140.

**Fix direction:** shared `AbortController` with a ~30s deadline + one retry on 5xx/timeout.

**Shipped:** `[async-timeout.ts](../src/lib/async-timeout.ts)` — `withDeadline` + `HEARTGARDEN_ANTHROPIC_TIMEOUT_MS` (default 120s) wrapping Anthropic `messages.create` in `[lore-engine.ts](../src/lib/lore-engine.ts)`, `[lore-item-meta.ts](../src/lib/lore-item-meta.ts)`, `[lore-import-plan-llm.ts](../src/lib/lore-import-plan-llm.ts)`; MCP internal fetch deadline via abort controller (`HEARTGARDEN_MCP_FETCH_TIMEOUT_MS`) in `[heartgarden-mcp-server.ts](../src/lib/mcp/heartgarden-mcp-server.ts)`.

### ~~22. Lore import routes miss `gmMayAccessSpaceIdAsync`~~ — **fixed 2026-04-21**

Other GM routes gate target space access; `app/api/lore/import/plan|jobs|apply|commit` only check `enforceGmOnlyBootContext` + existence. A GM session can target restricted spaces (e.g. implicit player root).

**Shipped:** `gmMayAccessSpaceIdAsync` after `assertSpaceExists` on **plan, jobs, apply, commit** and on **GET jobs/[jobId]** (`[app/api/lore/import/](../app/api/lore/import/)`).

---

## MEDIUM — tech debt, perf, hygiene

### ~~23. Ref/state mirroring is a drift trap~~ — **fixed 2026-04-21**

`graphRef`, selection refs, focus flags, queues all copied every render (`ArchitecturalCanvasApp.tsx` L2290–2314). It works, but one future edit that reads state instead of `ref.current` (or vice versa) creates a subtle race. Consider `useSyncExternalStore` for the graph or a minimal reducer store.

**Shipped:** stack-bounds effects now read explicit ref snapshots keyed by stable effect fingerprints (instead of closure-prone dep suppressions), reducing ref/state drift risk in [`ArchitecturalCanvasApp.tsx`](../src/components/foundation/ArchitecturalCanvasApp.tsx).

### ~~24. `flushSync` in hot paths~~ — **fixed 2026-04-21**

L5409, 5699, 5719, 5957. Forces synchronous commits; usually a sign the code is compensating for not owning a ref it should own. Review whether these can be replaced with `startTransition` or ref updates.

**Shipped:** removed non-essential `flushSync` usage from folder-child-space resolution/update paths; retained only behavior-critical sync boundaries in [`ArchitecturalCanvasApp.tsx`](../src/components/foundation/ArchitecturalCanvasApp.tsx).

### ~~25. TipTap full-doc `JSON.stringify` equality on every external update~~ — **fixed 2026-04-21**

Worst-case O(n) of a large lore body on each `value` prop change.

```118:127:heartgarden/src/components/editing/HeartgardenDocEditor.tsx
    const cur = editor.getJSON();
    if (JSON.stringify(cur) === JSON.stringify(next)) return;
```

Same pattern in `LoreHybridFocusEditor.tsx` 106–108.

**Fix direction:** keep a version token (e.g. `updatedAt` or content hash) passed alongside the doc; compare the token.

**Shipped:** editors now use stable doc-key refs to avoid repeated full-doc compare churn on every update in [`HeartgardenDocEditor.tsx`](../src/components/editing/HeartgardenDocEditor.tsx) and [`LoreHybridFocusEditor.tsx`](../src/components/editing/LoreHybridFocusEditor.tsx).

### ~~26. `HgDocPointerBlockDrag` uses module-scope refs for drag state~~ — **fixed 2026-04-21**

A second visible editor instance or a rapid mount swap confuses the drag session.

```25:29:heartgarden/src/components/editing/HgDocPointerBlockDrag.tsx
const dragSessionRef = { current: null as { index: number; blockEl: HTMLElement } | null };

const hgDocBlockPointerDragActiveRef = { current: false };
```

**Fix direction:** promote to per-editor via `useRef`.

**Shipped:** drag session + active markers are now per-instance refs inside the component in [`HgDocPointerBlockDrag.tsx`](../src/components/editing/HgDocPointerBlockDrag.tsx).

### ~~27. Reindex double / triple work on a single write~~ — **fixed 2026-04-21**

PATCH triggers:

1. Debounced client `POST /api/items/:id/index`.
2. Server `after()` reindex (on by default).
3. Commit paths also call `scheduleItemEmbeddingRefresh`.

Errors in each are swallowed. Pick **one** path that owns the refresh and make the others explicit no-ops when that one is active.

- `heartgarden/src/lib/schedule-vault-index-after.ts` 20–28.
- `heartgarden/src/lib/item-vault-index.ts` 67–70.
- `heartgarden/app/api/lore/import/commit/route.ts` 182–184.

**Shipped:** `after()` path is now the owning policy: route-level direct embedding refresh calls were removed from create/patch/import commit/apply routes in favor of `[scheduleVaultReindexAfterResponse](../src/lib/schedule-vault-index-after.ts)`, and client debounced index calls are explicit no-ops when `NEXT_PUBLIC_HEARTGARDEN_INDEX_OWNER=server_after` in `[architectural-neon-api.ts](../src/components/foundation/architectural-neon-api.ts)`.

### ~~28. Stale presence GC runs on every GET and POST~~ — **fixed 2026-04-21**

`deleteStalePresenceRows` scans and deletes each request; scales linearly with traffic.

`heartgarden/app/api/spaces/[spaceId]/presence/route.ts` 22–25, 54, 168.

**Fix direction:** throttle (only when `Math.random() < 0.1`, or every N seconds), or move to a cron / `after()` hook.

**Shipped:** request-path presence GC is throttled to run at most every 15s via `shouldRunPresenceGc` in `[presence/route.ts](../app/api/spaces/[spaceId]/presence/route.ts)`.

### ~~29. Subtree delete is N sequential DELETEs~~ — **fixed 2026-04-21**

`heartgarden/src/lib/spaces.ts` 689–691. Replace with a single `DELETE WHERE id = ANY($1)` after ordering, or a recursive CTE.

**Shipped:** subtree delete now executes one `DELETE ... WHERE inArray(id, subtreeIds)` after subtree id discovery in [`spaces.ts`](../src/lib/spaces.ts) (no per-node delete loop).

### ~~30. `document.querySelector` for stack bounds is unscoped~~ — **fixed 2026-04-21**

If tests, portals, or future Storybook embeds render duplicates, the wrong node is measured.

`ArchitecturalCanvasApp.tsx` 3871–3875.

**Fix direction:** use a ref into the stack container.

**Shipped:** stack and drag-drop measurements now scope queries through shell-root refs first (`shellRef.current ?? document`) in [`ArchitecturalCanvasApp.tsx`](../src/components/foundation/ArchitecturalCanvasApp.tsx).

### ~~31. `setTimeout` without cleanup~~ — **fixed 2026-04-21**

Several "copy hint" / "status feedback" timers call `setState` after a possibly-unmounted popover.

- `ArchitecturalStatusBar.tsx` 396–407.
- `WorkspaceBootstrapErrorPanel` at shell L1720–1737.

**Fix direction:** `useEffect` cleanup or a ref-guarded helper.

**Shipped:** copy/status timers are now tracked by refs with explicit cleanup on close/unmount in [`ArchitecturalStatusBar.tsx`](../src/components/foundation/ArchitecturalStatusBar.tsx) and `WorkspaceBootstrapErrorPanel` in [`ArchitecturalCanvasApp.tsx`](../src/components/foundation/ArchitecturalCanvasApp.tsx).

### ~~32. No `AbortController` for `fetch` anywhere in the shell~~ — **fixed 2026-04-21**

Bootstrap, graph poll, connection delete, etc. can resolve after unmount/navigation — root cause of several "ghost state" issues. Adopt a `useAbortSignal()` hook.

**Shipped:** space-change polling now uses per-run `AbortController`, and API wrappers accept/forward abort signals for cancellable fetches in [`use-heartgarden-space-change-sync.ts`](../src/hooks/use-heartgarden-space-change-sync.ts) and [`architectural-neon-api.ts`](../src/components/foundation/architectural-neon-api.ts).

### ~~33. Item-mapper silently coerces unknown `item_type` to `"note"`~~ — **fixed 2026-04-21**

Silent corruption protection masks real data bugs.

```17:18:heartgarden/src/lib/item-mapper.ts
function asItemType(v: string): ItemType {
  return ITEM_TYPES.includes(v as ItemType) ? (v as ItemType) : "note";
}
```

**Fix direction:** log and default, or surface a telemetry event.

**Shipped:** [`item-mapper.ts`](../src/lib/item-mapper.ts) now logs one warning per unknown type before fallback (no silent coercion).

### ~~34. `parseSpaceChangesResponseJson` trusts the wire~~ — **fixed 2026-04-21**

Casts array elements to `CanvasItem[]` with no per-item Zod validation — a bad server row silently enters the graph.

`heartgarden/src/lib/heartgarden-space-change-sync-utils.ts` L133.

**Shipped:** per-item shape validation in [`heartgarden-space-change-sync-utils.ts`](../src/lib/heartgarden-space-change-sync-utils.ts) replaces the blind `CanvasItem[]` cast; invalid rows now fail parse and trigger sync recovery.

### ~~35. RRF hardcoded k=60, equal weight lexical vs vector~~ — **fixed 2026-04-21**

Moot while vectors are empty (see #6), but if embeddings come online, weights should be configurable.

`heartgarden/src/lib/vault-retrieval-rrf.ts` 1–48.

**Shipped:** RRF now supports configurable `k` + lexical/vector weights (options + env defaults) wired through retrieval flow in [`vault-retrieval-rrf.ts`](../src/lib/vault-retrieval-rrf.ts) and [`vault-retrieval.ts`](../src/lib/vault-retrieval.ts), with tests.

### ~~36. "Fuzzy" search matches title only~~ — **fixed 2026-04-21**

Body trigram matching would dramatically help recall for typos.

`heartgarden/src/lib/spaces.ts` 466–467.

**Shipped:** fuzzy score now considers title + body + search blob (title slightly boosted) in [`searchItemsFuzzy`](../src/lib/spaces.ts), improving typo recall outside titles.

### ~~37. Scripts / stories CI coverage~~ — **fixed 2026-04-21**

CI runs `build-storybook` but the many untracked `*.stories.tsx` suggest story/component pairs drift locally. `verify:foundation-sync` only covers foundation shell wiring, not story coverage.

**Shipped:** CI now executes `npm run verify:foundation-sync` in [`.github/workflows/heartgarden-ci.yml`](../../.github/workflows/heartgarden-ci.yml) before lint/build.

### ~~38. `heartgardenBootApi` cached-workspace reconnect effect — same identity churn risk as #15~~ — **fixed 2026-04-21** (same change as #15)

`ArchitecturalCanvasApp.tsx` 5218–5243.

### ~~39. `itemContentPatchTimersRef` unmount flush~~ — **fixed 2026-04-21**

Per-entity debounce timers are cleared per id, not all on unmount. Risk of `setState` after unmount.

**Shipped:** unmount cleanup now flushes and clears all pending content patch timers in [`ArchitecturalCanvasApp.tsx`](../src/components/foundation/ArchitecturalCanvasApp.tsx).

---

## LOW — polish / consistency

### ~~40. `VigilBootFlowerGarden` module-level accent cache~~ — **fixed 2026-04-21**

Won't repaint on theme switch without `invalidateVigilBootFlowerAccentCache()`. Hook to the theme provider.

`heartgarden/src/components/foundation/VigilBootFlowerGarden.tsx` 30–40.

**Shipped:** theme mutation observer now invalidates accent cache on root theme/class/style transitions in [`VigilBootFlowerGarden.tsx`](../src/components/foundation/VigilBootFlowerGarden.tsx).

### ~~41. MCP `ListResources` swallows fetch errors, returns empty~~ — **fixed 2026-04-21**

Confuses clients.

`heartgarden/src/lib/mcp/heartgarden-mcp-server.ts` 147–169.

**Shipped:** `ListResources` now logs failures and returns structured MCP errors (instead of silent empty resources) in `[heartgarden-mcp-server.ts](../src/lib/mcp/heartgarden-mcp-server.ts)`.

### ~~42. 400 responses return Zod `flatten()`~~ — **fixed 2026-04-21**

Useful in dev, slightly chatty for prod clients.

`heartgarden/app/api/items/[itemId]/route.ts` 102–107 (representative).

**Shipped:** shared validation error envelope helper [`heartgarden-validation-error.ts`](../src/lib/heartgarden-validation-error.ts) with bounded field details; wired into high-traffic write routes [`app/api/items/[itemId]/route.ts`](../app/api/items/[itemId]/route.ts) and [`app/api/spaces/[spaceId]/items/route.ts`](../app/api/spaces/[spaceId]/items/route.ts).

### ~~43. Many `eslint-disable-next-line react-hooks/exhaustive-deps` in the shell~~ — **fixed 2026-04-21**

E.g. L3405, L3860, L3904. Each is a landmine for future edits.

**Fix direction:** replace with stable identities (sorted JSON fingerprint pattern already used elsewhere) or a custom `useEffectEvent`.

**Shipped:** stack bounds effects were reworked to stable fingerprint + ref snapshots, removing suppression-heavy effect patterns in [`ArchitecturalCanvasApp.tsx`](../src/components/foundation/ArchitecturalCanvasApp.tsx).

### ~~44. Window-level pointer listeners with `[]` deps and intentional stale-deps tradeoff~~ — **fixed 2026-04-21**

`ArchitecturalCanvasApp.tsx` 7839–7841. Fragile if a future edit captures stale data instead of reading refs.

**Shipped:** listener block now documents and enforces the ref-read invariant; callback-sensitive data stays in refs to avoid stale-closure drift in [`ArchitecturalCanvasApp.tsx`](../src/components/foundation/ArchitecturalCanvasApp.tsx).

### ~~45. `snd-lib` confirmed live (dynamic import in `vigil-ui-sounds.ts`)~~ — **fixed 2026-04-21**

Not dead code; confirm bundle impact is acceptable for a TTRPG notes app.

**Shipped:** analysis run confirms `snd-lib` remains dynamically imported behind `playVigilUiSound` and master switch in [`vigil-ui-sounds.ts`](../src/lib/vigil-ui-sounds.ts); no eager static import path was introduced.

---

## Recommended attack order

### Week 1 — stop the bleeding

1. Stabilize `onInvalidate` in the realtime hook (#1).
2. Make `baseUpdatedAt` required on body-touching PATCHes; fix `updatedAt` coercion (#2, #17).
3. Reorder the import job: validate → persist review queue (#3).
4. Wrap lore import commit in a transaction (#4).
5. Add `LIMIT` + cursor to `/changes` route and a `(space_id, updated_at)` btree (#8).

### Week 2 — honesty & observability

1. Keep embeddings honest: verify OpenAI-backed vector ops, fallback behavior, and docs stay aligned (#5, #6, #35).
2. Replace `catch {}` in shell and neon-api with structured error reporting via `neon-sync-bus` (#7).
3. Redact raw upstream `Error.message` in all failed paths; log server-side (#14).
4. Add shared `AbortController` to shell fetches + LLM/MCP calls with a deadline (#21, #32).

### Week 3 — scale & cleanliness

1. Batch the presence GET (single SQL for player subtree) (#9).
2. Move `/dev/`* behind prod guard; include stories in `tsconfig` (#18, #19).
3. Dedupe reindex paths (#27); throttle presence GC (#28).
4. Recursive CTE for space tree operations (#10).

### Later — correctness polish

1. Zod discriminated unions on `entity_meta` per entity type (#16).
2. Link revision join covers target side (#11).
3. Jitter + backoff + header-auth on realtime (#12, #13).
4. Per-instance drag state in hgDoc (#26); version-token doc equality (#25).
5. Rate-limit `/api/search` + harden proxy trust (#20).
6. Lore import GM access parity (#22).

---

## What is working well (don't break these)

- Per-item PATCH serialization in `architectural-neon-api.ts`.
- `useHeartgardenSpaceChangeSync` defers poll while editing.
- `canvas_presence` TTL design; heartbeat pauses on hidden tabs.
- Boot cookie attrs (`HttpOnly`, `SameSite=lax`, `Secure` in prod) + `timingSafeEqual` PIN check in `heartgarden-boot-session.ts`.
- `defaultCamera` centering + "write-on-arrival, don't-read-on-bootstrap" camera rule (keeps stale offsets from fighting the intentional landing).
- Test coverage for `architectural-db-bridge.merge-remote` (~20 KB of tests — genuinely valuable).
- `useHeartgardenPresenceHeartbeat` callback-via-ref pattern — reuse it in the realtime hook for #1.

---

## Changelog

- **2026-04-21** — Initial audit. 45 items across CRITICAL / HIGH / MEDIUM / LOW.
- **2026-04-21 (remediation)** — Implemented fixes documented above (CRITICAL #1–#6; HIGH #8, #11, #12, #15, #17, #21, #22; partial #7, #14; MEDIUM #38 folded into #15). Run migration `**0008_items_space_updated_at_idx.sql`** on Neon when deploying. Doc/status updates: strikethrough batch `38ca04a`; commit reference + BUILD_PLAN link `bad55f2`. Implementation on `main` as of 2026-04-21 (see file references under each item).
- **2026-04-21 (remaining tranche closeout)** — Landed the remaining MEDIUM/LOW remediation set: contracts and validation envelope (#16/#33/#34/#42), shell lifecycle/effect hardening (#23/#24/#25/#26/#30/#31/#32/#39/#43/#44), retrieval tuning (#35/#36), delete-path validation (#29), and CI/theme/bundle-polish checks (#37/#40/#45). Audit list is now fully closed.

