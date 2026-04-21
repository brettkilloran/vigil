---

## title: heartgarden — code health audit (2026-04-21)

status: supporting
audience: [agent, human]
last_reviewed: 2026-04-21
related:

- heartgarden/docs/BUILD_PLAN.md
- heartgarden/docs/FOLLOW_UP.md
- heartgarden/docs/CODEMAP.md
- heartgarden/docs/API.md

# heartgarden — code health audit (2026-04-21)

A read-only review of the production shell, sync layer, search/vault, editor, realtime, and operational hygiene. The app is largely **vibecoded**, so findings cluster around three themes:

1. **Silent failure culture** — `catch {}` hides real bugs from users and ops.
2. **Correctness drift** — optimistic lock optional; "hybrid" search where the vector provider is permanently stubbed; link revision joins only one side.
3. **Unbounded work** — delta reads without `LIMIT`; full-space scans on hot paths; presence GC on every request.

This file is a **living backlog** — work items below are intended to be picked up progressively. Check off items when merged; open a plan in `.cursor/plans/` only if the fix needs multi-step coordination. Cross-link shipped fixes from `**BUILD_PLAN.md`** if they close an architectural concern.

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

### 1. Realtime WebSocket reconnects on every canvas re-render

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

### 2. Optimistic locking is optional and brittle

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

### 3. Import review queue is written before plan validation

`persistImportReviewQueueFromPlan` runs **before** `loreImportPlanSchema.safeParse`. If validation fails, the job is marked `failed`, but pending `import_review_items` may already be inserted/replaced for that batch. Bad LLM output corrupts the user's review queue.

`heartgarden/src/lib/lore-import-job-process.ts` ~L68–80 (persist) vs ~L70–80 (validate).

**Fix direction:** reorder — validate, then persist.

### 4. Lore import commit is not transactional

`/api/lore/import/commit` performs many sequential `insert(items)` and `insert(itemLinks)`. A mid-flight failure leaves orphan notes without their links, partial folder trees, or half-applied reviews.

`heartgarden/app/api/lore/import/commit/route.ts` 141–273.

**Fix direction:** wrap in a single `db.transaction(...)`. Neon-serverless supports it.

### 5. Vector index drifts when embedding fails

`reindexItemVault` updates `items.search_blob` and sometimes lore fields **before** calling `embedTexts`. If embedding throws, lexical content is already new; old `item_embeddings` rows are never cleared. Hybrid retrieval then ranks new lexical content against stale vectors.

`heartgarden/src/lib/item-vault-index.ts` ~L123–166.

**Fix direction:** do `clearItemEmbeddings` + lexical update + new embedding insert in one transaction, or don't touch `search_blob` until embedding succeeds. Currently moot while #6 holds.

### 6. "Hybrid" search is a lie

`isEmbeddingApiConfigured()` is hardcoded `false`; `embedTexts` always throws; `vault-retrieval.ts` silently catches and sets `vecHits = []`. The app exposes a `semantic` mode and advertises "RRF fusion" but it's pure FTS + fuzzy. `GET /api/search?mode=hybrid` also diverges from `hybridRetrieveItems` — if FTS returns ≥12 hits the route short-circuits to FTS-only while the library still merges fuzzy.

```11:22:heartgarden/src/lib/embedding-provider.ts

```

```166:172:heartgarden/src/lib/vault-retrieval.ts

```

**Fix direction:** either wire a real provider (OpenAI / Voyage / Cohere — pgvector is already in the schema), or delete `semantic` / `hybrid` modes, the vector SQL, and the RRF code to kill a large dead surface.

---

## HIGH — real bugs or operational risk

### 7. Silent failure culture in the shell

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

### 8. Unbounded delta payloads

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

### 9. O(peers) serial DB calls on presence GET

Player tier awaits `spaceIsUnderPlayerRoot` inside a `for (const r of rows)` loop.

`heartgarden/app/api/spaces/[spaceId]/presence/route.ts` 91–95.

**Fix direction:** compute the allowed subtree once via a single SQL pass, then filter in JS.

### 10. Full-table scans for space operations

`assertSpaceReparentAllowed`, `deleteSpaceSubtree`, and the presence route each `select({id, parentSpaceId}).from(spaces)` — loading every space to walk a local tree. Fine at hundreds of spaces, painful at thousands.

- `heartgarden/src/lib/spaces.ts` 200–205 and 651–653.
- `heartgarden/app/api/spaces/[spaceId]/presence/route.ts` 61–63.

**Fix direction:** recursive CTE scoped to the target subtree, or cache `parentSpaceId` in an in-memory map with TTL.

### 11. Link revision fingerprint can miss changes

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

### 12. Reconnect scheduler is a flat 2s with no jitter

After a realtime server blip, every client tab aligns on the same cadence and hammers `/api/realtime/room-token`.

`heartgarden/src/hooks/use-heartgarden-realtime-space-sync.ts` 44–49.

**Fix direction:** exponential backoff with ±30% jitter; cap at ~30s.

### 13. JWT passed as WebSocket query string

Tokens end up in edge/proxy logs, referer headers, and browser history for the realtime URL. The file `heartgarden-realtime-token.ts` defines `heartgardenRealtimeSocketAuthHeader` but it is **never referenced** — an abandoned header-auth branch.

- `heartgarden/src/hooks/use-heartgarden-realtime-space-sync.ts` L73.
- `heartgarden/scripts/realtime-server.ts` 157–163.
- `heartgarden/src/lib/heartgarden-realtime-token.ts` 83–87 (dead helper).

**Fix direction:** finish header-based auth (e.g. `Sec-WebSocket-Protocol` subprotocol trick), or rotate tokens aggressively.

### 14. Error-message leakage to clients

Several routes return raw `Error.message`:

- `POST /api/items/:id/index` → `{error: e.message}` (502) — `app/api/items/[itemId]/index/route.ts` 72–82.
- `GET /api/search/chunks` — embedding errors echoed; `app/api/search/chunks/route.ts` 74–76.
- Import jobs persist raw `Error.message` and serve it on `GET /:jobId` — `lore-import-job-process.ts` 92–101; `[jobId]/route.ts` 93–97.
- MCP tools return raw `await res.text()` in many places — `src/lib/mcp/heartgarden-mcp-server.ts` 667, 685, 711, 731, 1385, 1421, 1436, 1453.

**Fix direction:** standard `{error, code}` with opaque codes; log the full message server-side only.

### 15. Canvas bootstrap effect over-depends on `heartgardenBootApi`

The whole API object is in the dep array of the bootstrap and cached-workspace effects (shell L5061–5216 and L5218–5243). Any identity change re-runs the async bootstrap race — duplicate `/api/bootstrap` calls, repeated graph resets, lost `cancelled` guards under fast toggles.

**Fix direction:** destructure only the primitive inputs you actually read; wrap callbacks in `useCallback`.

### 16. `entity_meta` / `content_json` are `z.any()` JSON god-objects

No size cap, no discriminated-union validation, no DB `CHECK` constraints. That's where `aiReview`, `factionRoster`, `loreThreadAnchors`, campaign epoch etc. all live — the backbone of the lore model has zero schema contract.

- `heartgarden/app/api/items/[itemId]/route.ts` 51–76.
- `heartgarden/src/db/schema.ts` 79–80.

**Fix direction:** introduce Zod discriminated unions per `entity_type`; add a 1–2 MB JSON size cap.

### 17. `rowToCanvasItem(row!)` after UPDATE can throw

`drizzle.update().returning()` returns `[]` if the row was deleted between the read and update. The `!` surfaces as a 500.

`heartgarden/app/api/items/[itemId]/route.ts` 246–282.

**Fix direction:** guard `if (!row) return 404`.

### 18. Stories are excluded from TypeScript strict checking

`tsconfig.json` excludes `**/*.stories.{ts,tsx}`. Storybook builds them separately, but type errors there won't break `npm run check`. Given the many untracked story files in the working tree, this is actively masking drift.

```33:34:heartgarden/tsconfig.json
  "exclude": ["node_modules", "**/*.stories.ts", "**/*.stories.tsx"]
```

**Fix direction:** remove the exclusion; fix whatever falls out once.

### 19. Dev-only code ships to production

`app/dev/lore-entity-nodes/page.tsx` + `src/components/dev/LoreEntityNodeLab.tsx` (~147 KB) and `app/dev/ai-pending-style/` are regular app routes and appear in the production build. Worth ~150 KB+ of JS plus an internal surface anyone who can hit `/dev/`* can see.

**Fix direction:** wrap with `notFound()` in prod, or guard behind an env flag, or move under a conditional rewrite.

### 20. No rate-limit on `/api/search`

`/api/lore/query` and the index routes have one, but search does not — and MCP drives search via HTTP. An automated loop can hammer FTS + trigram joins. `src/lib/lore-query-rate-limit.ts` + `vault-index-rate-limit.ts` trust first-hop `X-Forwarded-For` (spoofable if the edge doesn't strip it) and their cleanup only kicks in at >10k entries.

**Fix direction:** share a rate-limit helper; validate `X-Forwarded-For` against a trusted proxy list.

### 21. LLM calls have no timeout, abort, or retry budget

- `lore-engine.ts` 189–194
- `lore-item-meta.ts` 26–38
- `lore-import-plan-llm.ts` 188–193

All call Anthropic with `max_tokens` only. A hung provider pins route-handler concurrency and UI spinners. MCP `fetch` calls are also abort-less — `src/lib/mcp/heartgarden-mcp-server.ts` 136–140.

**Fix direction:** shared `AbortController` with a ~30s deadline + one retry on 5xx/timeout.

### 22. Lore import routes miss `gmMayAccessSpaceIdAsync`

Other GM routes gate target space access; `app/api/lore/import/plan|jobs|apply|commit` only check `enforceGmOnlyBootContext` + existence. A GM session can target restricted spaces (e.g. implicit player root).

---

## MEDIUM — tech debt, perf, hygiene

### 23. Ref/state mirroring is a drift trap

`graphRef`, selection refs, focus flags, queues all copied every render (`ArchitecturalCanvasApp.tsx` L2290–2314). It works, but one future edit that reads state instead of `ref.current` (or vice versa) creates a subtle race. Consider `useSyncExternalStore` for the graph or a minimal reducer store.

### 24. `flushSync` in hot paths

L5409, 5699, 5719, 5957. Forces synchronous commits; usually a sign the code is compensating for not owning a ref it should own. Review whether these can be replaced with `startTransition` or ref updates.

### 25. TipTap full-doc `JSON.stringify` equality on every external update

Worst-case O(n) of a large lore body on each `value` prop change.

```118:127:heartgarden/src/components/editing/HeartgardenDocEditor.tsx
    const cur = editor.getJSON();
    if (JSON.stringify(cur) === JSON.stringify(next)) return;
```

Same pattern in `LoreHybridFocusEditor.tsx` 106–108.

**Fix direction:** keep a version token (e.g. `updatedAt` or content hash) passed alongside the doc; compare the token.

### 26. `HgDocPointerBlockDrag` uses module-scope refs for drag state

A second visible editor instance or a rapid mount swap confuses the drag session.

```25:29:heartgarden/src/components/editing/HgDocPointerBlockDrag.tsx
const dragSessionRef = { current: null as { index: number; blockEl: HTMLElement } | null };

const hgDocBlockPointerDragActiveRef = { current: false };
```

**Fix direction:** promote to per-editor via `useRef`.

### 27. Reindex double / triple work on a single write

PATCH triggers:

1. Debounced client `POST /api/items/:id/index`.
2. Server `after()` reindex (on by default).
3. Commit paths also call `scheduleItemEmbeddingRefresh`.

Errors in each are swallowed. Pick **one** path that owns the refresh and make the others explicit no-ops when that one is active.

- `heartgarden/src/lib/schedule-vault-index-after.ts` 20–28.
- `heartgarden/src/lib/item-vault-index.ts` 67–70.
- `heartgarden/app/api/lore/import/commit/route.ts` 182–184.

### 28. Stale presence GC runs on every GET and POST

`deleteStalePresenceRows` scans and deletes each request; scales linearly with traffic.

`heartgarden/app/api/spaces/[spaceId]/presence/route.ts` 22–25, 54, 168.

**Fix direction:** throttle (only when `Math.random() < 0.1`, or every N seconds), or move to a cron / `after()` hook.

### 29. Subtree delete is N sequential DELETEs

`heartgarden/src/lib/spaces.ts` 689–691. Replace with a single `DELETE WHERE id = ANY($1)` after ordering, or a recursive CTE.

### 30. `document.querySelector` for stack bounds is unscoped

If tests, portals, or future Storybook embeds render duplicates, the wrong node is measured.

`ArchitecturalCanvasApp.tsx` 3871–3875.

**Fix direction:** use a ref into the stack container.

### 31. `setTimeout` without cleanup

Several "copy hint" / "status feedback" timers call `setState` after a possibly-unmounted popover.

- `ArchitecturalStatusBar.tsx` 396–407.
- `WorkspaceBootstrapErrorPanel` at shell L1720–1737.

**Fix direction:** `useEffect` cleanup or a ref-guarded helper.

### 32. No `AbortController` for `fetch` anywhere in the shell

Bootstrap, graph poll, connection delete, etc. can resolve after unmount/navigation — root cause of several "ghost state" issues. Adopt a `useAbortSignal()` hook.

### 33. Item-mapper silently coerces unknown `item_type` to `"note"`

Silent corruption protection masks real data bugs.

```17:18:heartgarden/src/lib/item-mapper.ts
function asItemType(v: string): ItemType {
  return ITEM_TYPES.includes(v as ItemType) ? (v as ItemType) : "note";
}
```

**Fix direction:** log and default, or surface a telemetry event.

### 34. `parseSpaceChangesResponseJson` trusts the wire

Casts array elements to `CanvasItem[]` with no per-item Zod validation — a bad server row silently enters the graph.

`heartgarden/src/lib/heartgarden-space-change-sync-utils.ts` L133.

### 35. RRF hardcoded k=60, equal weight lexical vs vector

Moot while vectors are empty (see #6), but if embeddings come online, weights should be configurable.

`heartgarden/src/lib/vault-retrieval-rrf.ts` 1–48.

### 36. "Fuzzy" search matches title only

Body trigram matching would dramatically help recall for typos.

`heartgarden/src/lib/spaces.ts` 466–467.

### 37. Scripts / stories CI coverage

CI runs `build-storybook` but the many untracked `*.stories.tsx` suggest story/component pairs drift locally. `verify:foundation-sync` only covers foundation shell wiring, not story coverage.

### 38. `heartgardenBootApi` cached-workspace reconnect effect — same identity churn risk as #15

`ArchitecturalCanvasApp.tsx` 5218–5243.

### 39. `itemContentPatchTimersRef` unmount flush

Per-entity debounce timers are cleared per id, not all on unmount. Risk of `setState` after unmount.

---

## LOW — polish / consistency

### 40. `VigilBootFlowerGarden` module-level accent cache

Won't repaint on theme switch without `invalidateVigilBootFlowerAccentCache()`. Hook to the theme provider.

`heartgarden/src/components/foundation/VigilBootFlowerGarden.tsx` 30–40.

### 41. MCP `ListResources` swallows fetch errors, returns empty

Confuses clients.

`heartgarden/src/lib/mcp/heartgarden-mcp-server.ts` 147–169.

### 42. 400 responses return Zod `flatten()`

Useful in dev, slightly chatty for prod clients.

`heartgarden/app/api/items/[itemId]/route.ts` 102–107 (representative).

### 43. Many `eslint-disable-next-line react-hooks/exhaustive-deps` in the shell

E.g. L3405, L3860, L3904. Each is a landmine for future edits.

**Fix direction:** replace with stable identities (sorted JSON fingerprint pattern already used elsewhere) or a custom `useEffectEvent`.

### 44. Window-level pointer listeners with `[]` deps and intentional stale-deps tradeoff

`ArchitecturalCanvasApp.tsx` 7839–7841. Fragile if a future edit captures stale data instead of reading refs.

### 45. `snd-lib` confirmed live (dynamic import in `vigil-ui-sounds.ts`)

Not dead code; confirm bundle impact is acceptable for a TTRPG notes app.

---

## Recommended attack order

### Week 1 — stop the bleeding

1. Stabilize `onInvalidate` in the realtime hook (#1).
2. Make `baseUpdatedAt` required on body-touching PATCHes; fix `updatedAt` coercion (#2, #17).
3. Reorder the import job: validate → persist review queue (#3).
4. Wrap lore import commit in a transaction (#4).
5. Add `LIMIT` + cursor to `/changes` route and a `(space_id, updated_at)` btree (#8).

### Week 2 — honesty & observability

1. Decide on embeddings: wire a provider or delete the vector code paths and docs (#5, #6).
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

