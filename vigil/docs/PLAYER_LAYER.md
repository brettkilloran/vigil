# Player layer (visitor PIN + scoped space)

When the boot gate is on and the user signs in with the **visitor** PIN (`HEARTGARDEN_BOOT_PIN_VISITOR`), the signed httpOnly cookie **`hg_boot`** carries tier **`visitor`**. The app treats this as a **player layer**: read/write is limited to a single Neon space UUID from **`HEARTGARDEN_PLAYER_SPACE_ID`**. The **GM** path (**`access`** tier, gate off, or no cookie while gate on — pre-PIN) is unchanged.

Full detail lives in server helper [`src/lib/heartgarden-api-boot-context.ts`](../src/lib/heartgarden-api-boot-context.ts).

## Invariants (do not regress)

1. **GM path unchanged** — Logic branches must be **`if (visitor)`** only. Never default the app to visitor behavior.
2. **Fail closed** — Missing/invalid **`HEARTGARDEN_PLAYER_SPACE_ID`** or space not in DB → visitor gets **403** on scoped routes (constant body `{ ok: false, error: "Forbidden." }`). No fallback to “first space”.
3. **Defense in depth** — Bootstrap scoping is UX; every API that uses `spaceId` / `itemId` re-checks tier and resolves ownership from the DB where required.
4. **Flat space (Option A)** — Visitors may only access items whose **`space_id`** equals **`HEARTGARDEN_PLAYER_SPACE_ID`** exactly (no child-space drill-down for visitors).
5. **No recon-by-error** — Denial bodies stay generic. For **visitor**, missing spaces/items/links return **403** with the same constant JSON as other denials (not **404**), so clients cannot infer whether a UUID exists in another space. **GM** sessions keep normal **404** where applicable.
6. **Same browser, two cookies** — GM machines use **`access`**; do not share the GM PIN on untrusted player devices.
7. **Boot brute-force** — `POST /api/heartgarden/boot` is **rate-limited per IP** (in-memory per server instance; tunable via env). **`PLAYWRIGHT_E2E=1`** disables the limit for CI.

## Collaboration caveat

There is no realtime merge layer: multiple visitors editing the **same** note are **last-write-wins** via Neon PATCH. Different cards scale better.

## Client feature matrix (`ArchitecturalCanvasApp`)

When **`isPlayerLayer`** (boot loaded, gate on, **`sessionTier === "visitor"`**):

| Surface | Visitor |
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
4. For **visitor**, use **`heartgardenMaskNotFoundForVisitor()`** instead of returning **404** for missing rows so errors stay indistinguishable.

## Regression checklist

**GM (access PIN or gate off)**

- [ ] `GET /api/heartgarden/boot` → `sessionTier` is **`access`** or **`null`** as appropriate; full bootstrap shape unchanged.
- [ ] Lore query, import, vault review, reindex, presign, hybrid/semantic search still work when keys/env allow.

**Visitor (visitor PIN + valid `HEARTGARDEN_PLAYER_SPACE_ID`)**

- [ ] `GET /api/heartgarden/boot` → `sessionValid: true`, `sessionTier: "visitor"`.
- [ ] `GET /api/bootstrap` lists **only** the player space and its items.
- [ ] `PATCH /api/items/<id>` for an item in another space → **403**.
- [ ] Random non-existent item UUID → **403** (not **404**) so existence is not leaked.
- [ ] `POST /api/lore/query` (and other lore routes) → **403**.
- [ ] `POST /api/upload/presign` → **403**.
- [ ] UI: no lore/import/vault/graph export entry points.

**Visitor misconfiguration**

- [ ] Visitor cookie but missing/invalid player space env → bootstrap and mutating routes **403** (not GM data).
