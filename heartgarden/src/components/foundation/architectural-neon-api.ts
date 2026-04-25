import type { BootstrapResponse } from "@/src/components/foundation/architectural-db-bridge";
import {
  PRESENCE_SIGIL_VARIANTS,
  type PresenceSigilVariant,
} from "@/src/lib/collab-presence-identity";
import {
  recordItemPatchConflict,
  recordItemPatchOk,
} from "@/src/lib/heartgarden-collab-metrics";
import {
  parseSpaceChangesResponseJson,
  type SpaceChangePayloadRow,
} from "@/src/lib/heartgarden-space-change-sync-utils";
import {
  heartgardenSyncDebugLog,
  isHeartgardenSyncDebugEnabled,
} from "@/src/lib/heartgarden-sync-debug";
import {
  getNeonSyncSnapshot,
  neonSyncBeginRequest,
  neonSyncEndRequest,
} from "@/src/lib/neon-sync-bus";
import {
  parseJsonBody,
  syncFailureFromApiResponse,
} from "@/src/lib/sync-error-diagnostic";
import {
  vaultIndexClearInFlight,
  vaultIndexClearPending,
  vaultIndexMarkInFlight,
  vaultIndexMarkPending,
  vaultIndexSetError,
} from "@/src/lib/vault-index-status-bus";
import type { CameraState, CanvasItem } from "@/src/model/canvas-types";

const vaultIndexTimers = new Map<string, ReturnType<typeof setTimeout>>();
const VAULT_INDEX_DEBOUNCE_MS = 2800;

function isServerAfterVaultIndexOwner(): boolean {
  const owner = (
    process.env.NEXT_PUBLIC_HEARTGARDEN_INDEX_OWNER ?? "server_after"
  )
    .trim()
    .toLowerCase();
  return owner === "server_after";
}

/** When true, skip debounced `POST /api/items/:id/index` (Players tier — route is GM-only). */
let vaultIndexClientDisabledForPlayerLayer = false;

function clearAllVaultIndexTimers() {
  const ids = [...vaultIndexTimers.keys()];
  for (const id of ids) {
    const t = vaultIndexTimers.get(id);
    if (t) {
      clearTimeout(t);
    }
    vaultIndexTimers.delete(id);
    vaultIndexClearPending(id);
  }
}

/**
 * Call from the shell when the session is the Players access layer. Prevents client-side
 * vault index requests that always 403 and spam {@link vaultIndexSetError} / status churn.
 */
export function neonVaultIndexSetPlayerLayerActive(active: boolean) {
  const next = active;
  if (vaultIndexClientDisabledForPlayerLayer === next) {
    return;
  }
  vaultIndexClientDisabledForPlayerLayer = next;
  if (next) {
    clearAllVaultIndexTimers();
  }
}

function scheduleVaultIndexForItem(itemId: string) {
  if (vaultIndexClientDisabledForPlayerLayer) {
    return;
  }
  if (isServerAfterVaultIndexOwner()) {
    return;
  }
  const prev = vaultIndexTimers.get(itemId);
  if (prev) {
    clearTimeout(prev);
  }
  vaultIndexMarkPending(itemId);
  const t = setTimeout(() => {
    vaultIndexTimers.delete(itemId);
    vaultIndexClearPending(itemId);
    if (vaultIndexClientDisabledForPlayerLayer) {
      return;
    }
    vaultIndexMarkInFlight(itemId);
    void (async () => {
      try {
        const res = await fetch(
          `/api/items/${encodeURIComponent(itemId)}/index`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          }
        );
        const rawText = await res.text();
        let body: Record<string, unknown> = {};
        try {
          body = rawText.trim()
            ? (JSON.parse(rawText) as Record<string, unknown>)
            : {};
        } catch {
          body = {};
        }
        if (res.status === 403) {
          /* GM-only route; ignore (e.g. race before player-layer flag applied). */
        } else if (res.status === 429) {
          vaultIndexSetError("Search index rate limited — try again shortly.");
        } else if (!res.ok) {
          const err =
            typeof body.error === "string"
              ? body.error
              : `Index failed (${res.status})`;
          vaultIndexSetError(err);
        } else if (body.ok !== true) {
          vaultIndexSetError(
            typeof body.error === "string"
              ? body.error
              : "Index did not complete."
          );
        }
      } catch {
        vaultIndexSetError("Search index request failed (network).");
      } finally {
        vaultIndexClearInFlight(itemId);
      }
    })();
  }, VAULT_INDEX_DEBOUNCE_MS);
  vaultIndexTimers.set(itemId, t);
}

function finishNeonTrack(
  track: boolean,
  operation: string,
  res: Response,
  rawText: string,
  body: Record<string, unknown>,
  logicalOk: boolean
) {
  if (!track) {
    return;
  }
  if (logicalOk) {
    neonSyncEndRequest(true);
    return;
  }
  const detail = syncFailureFromApiResponse(
    operation,
    res,
    rawText,
    body,
    logicalOk
  );
  neonSyncEndRequest(
    false,
    detail ?? {
      operation,
      httpStatus: res.status,
      message: `HTTP ${res.status}`,
      cause: "http",
    }
  );
}

/** One logical PATCH at a time per item; the next call runs after the previous finishes (incl. 409 retry in the shell). */
const itemPatchChains = new Map<string, Promise<unknown>>();

function runSerializedItemPatch<T>(
  itemId: string,
  fn: () => Promise<T>
): Promise<T> {
  const prev = itemPatchChains.get(itemId) ?? Promise.resolve();
  const chained = prev.then(
    () => fn(),
    () => fn()
  );
  const wrapped = chained.finally(() => {
    if (itemPatchChains.get(itemId) === wrapped) {
      itemPatchChains.delete(itemId);
    }
  });
  itemPatchChains.set(itemId, wrapped);
  return chained;
}

export type ApiPatchItemResult =
  | { ok: true; item: CanvasItem }
  | { ok: false; conflict: true; item: CanvasItem }
  | { ok: false; gone: true }
  | { ok: false; error?: string };

/**
 * Why: when `/api/bootstrap` fails, the shell needs the **reason** (HTTP status +
 * short server message) so {@link WorkspaceBootstrapErrorPanel} can render it
 * instead of a generic "could not load workspace" — which hides schema drift,
 * forbidden sessions, and real outages behind the same string. Keep
 * {@link fetchBootstrap} as the legacy thin wrapper so existing callers that
 * only care about "did we get a live workspace" do not change.
 *
 * Causes:
 *   - `demo`: server returned `{ ok: true, demo: true }` (DB unconfigured or Playwright E2E).
 *   - `forbidden`: HTTP 403 (player layer blocked / mis-scoped session).
 *   - `http`: HTTP !ok (4xx/5xx) with or without a JSON body.
 *   - `parse`: server returned non-JSON (often the 500 empty-body path).
 *   - `network`: `fetch` threw (offline, DNS, TLS, CORS, etc.). `AbortError` is rethrown so
 *      caller-side cancellation logic keeps working.
 */
export type BootstrapFetchDetail =
  | { ok: true; data: BootstrapResponse & { demo: false; spaceId: string } }
  | { ok: false; cause: "demo"; status: number; data: BootstrapResponse }
  | { ok: false; cause: "forbidden"; status: number; message?: string }
  | { ok: false; cause: "http"; status: number; message?: string }
  | { ok: false; cause: "parse"; status: number }
  | { ok: false; cause: "network"; message: string };

function extractServerErrorMessage(body: unknown): string | undefined {
  if (body && typeof body === "object") {
    const err = (body as { error?: unknown }).error;
    if (typeof err === "string" && err.trim()) {
      return err.trim();
    }
  }
  return;
}

export async function fetchBootstrapDetailed(
  spaceId?: string,
  options?: { signal?: AbortSignal }
): Promise<BootstrapFetchDetail> {
  const q = spaceId ? `?space=${encodeURIComponent(spaceId)}` : "";
  let res: Response;
  try {
    res = await fetch(`/api/bootstrap${q}`, { signal: options?.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw e;
    }
    return {
      ok: false,
      cause: "network",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  const rawText = await res.text();
  let body: unknown = null;
  if (rawText.trim()) {
    try {
      body = JSON.parse(rawText);
    } catch {
      return { ok: false, cause: "parse", status: res.status };
    }
  }

  if (!res.ok) {
    const message = extractServerErrorMessage(body);
    if (res.status === 403) {
      return { ok: false, cause: "forbidden", status: res.status, message };
    }
    return { ok: false, cause: "http", status: res.status, message };
  }

  const data = (body as BootstrapResponse | null) ?? null;
  if (!data || data.ok !== true) {
    return {
      ok: false,
      cause: "http",
      status: res.status,
      message: extractServerErrorMessage(body) ?? "Response ok=false",
    };
  }
  if (data.demo === true || !data.spaceId) {
    return { ok: false, cause: "demo", status: res.status, data };
  }
  return {
    ok: true,
    data: data as BootstrapResponse & { demo: false; spaceId: string },
  };
}

/**
 * Legacy thin wrapper: returns a {@link BootstrapResponse} for any 200 + `ok: true`
 * payload (live **or** demo), and `null` for HTTP errors with a JSON body.
 * Throws for network failures / non-JSON 5xx so existing try/catch paths keep
 * working. New code should prefer {@link fetchBootstrapDetailed}.
 */
export async function fetchBootstrap(
  spaceId?: string,
  options?: { signal?: AbortSignal }
): Promise<BootstrapResponse | null> {
  const result = await fetchBootstrapDetailed(spaceId, options);
  if (result.ok) {
    return result.data;
  }
  if (result.cause === "demo") {
    return result.data;
  }
  if (result.cause === "forbidden" || result.cause === "http") {
    return null;
  }
  if (result.cause === "parse") {
    throw new Error(`Bootstrap returned non-JSON (status ${result.status})`);
  }
  throw new Error(`Bootstrap network error: ${result.message}`);
}

export type { SpaceChangePayloadRow };

export type SpaceChangesSuccess = {
  ok: true;
  items?: CanvasItem[];
  /** Subtree `spaces` rows updated since `since` (e.g. reparent / rename). */
  spaces?: SpaceChangePayloadRow[];
  itemIds?: string[];
  cursor?: string;
  itemLinksRevision?: string;
  /** More rows exist after `cursor`; caller should re-poll with `since=cursor`. */
  hasMore?: boolean;
};

export type SpaceChangesFailure = {
  ok: false;
  error: string;
  cause: "http" | "parse" | "network";
  httpStatus?: number;
};

export type SpaceChangesResponse = SpaceChangesSuccess | SpaceChangesFailure;

function spaceChangesFailure(
  cause: SpaceChangesFailure["cause"],
  error: string,
  httpStatus?: number
): SpaceChangesFailure {
  return {
    ok: false,
    error,
    cause,
    ...(httpStatus == null ? {} : { httpStatus }),
  };
}

export async function fetchSpaceChanges(
  spaceId: string,
  since: string,
  options?: { includeItemIds?: boolean; signal?: AbortSignal }
): Promise<SpaceChangesResponse> {
  const q = new URLSearchParams();
  q.set("since", since);
  q.set("limit", "500");
  if (options?.includeItemIds) {
    q.set("includeItemIds", "1");
  }
  try {
    const res = await fetch(
      `/api/spaces/${encodeURIComponent(spaceId)}/changes?${q.toString()}`,
      { signal: options?.signal }
    );
    let raw: unknown;
    try {
      raw = await res.json();
    } catch {
      return spaceChangesFailure(
        "parse",
        "Space changes response was not valid JSON",
        res.status
      );
    }
    if (!res.ok) {
      const msg =
        typeof raw === "object" &&
        raw != null &&
        typeof (raw as { error?: unknown }).error === "string"
          ? (raw as { error: string }).error
          : `Space changes request failed (${res.status})`;
      return spaceChangesFailure("http", msg, res.status);
    }
    if (
      typeof raw !== "object" ||
      raw === null ||
      (raw as { ok?: unknown }).ok !== true
    ) {
      return spaceChangesFailure(
        "parse",
        "Space changes payload failed contract check",
        res.status
      );
    }
    const parsed = parseSpaceChangesResponseJson(raw, {
      requireItemIds: options?.includeItemIds === true,
    });
    if (!parsed) {
      return spaceChangesFailure(
        "parse",
        "Space changes payload missing required fields",
        res.status
      );
    }
    return {
      ok: true,
      items: parsed.items,
      ...(parsed.spaces.length > 0 ? { spaces: parsed.spaces } : {}),
      ...(parsed.itemIds === undefined ? {} : { itemIds: parsed.itemIds }),
      ...(parsed.cursor === undefined ? {} : { cursor: parsed.cursor }),
      ...(parsed.itemLinksRevision === undefined
        ? {}
        : { itemLinksRevision: parsed.itemLinksRevision }),
      ...(parsed.hasMore === true ? { hasMore: true } : {}),
    };
  } catch (e) {
    return spaceChangesFailure(
      "network",
      e instanceof Error ? e.message : "Network error"
    );
  }
}

export type SpacePresencePeer = {
  clientId: string;
  activeSpaceId: string;
  camera: CameraState;
  pointer: { x: number; y: number } | null;
  displayName: string | null;
  sigil: PresenceSigilVariant | null;
  updatedAt: string;
};

function parseSpacePresencePeer(raw: unknown): SpacePresencePeer | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.clientId !== "string" || typeof o.activeSpaceId !== "string") {
    return null;
  }
  if (typeof o.updatedAt !== "string") {
    return null;
  }
  const cam = o.camera;
  if (typeof cam !== "object" || cam === null) {
    return null;
  }
  const c = cam as Record<string, unknown>;
  if (
    typeof c.x !== "number" ||
    typeof c.y !== "number" ||
    typeof c.zoom !== "number"
  ) {
    return null;
  }
  const displayName = typeof o.displayName === "string" ? o.displayName : null;
  const sigil =
    typeof o.sigil === "string" &&
    PRESENCE_SIGIL_VARIANTS.includes(o.sigil as PresenceSigilVariant)
      ? (o.sigil as PresenceSigilVariant)
      : null;
  let pointer: { x: number; y: number } | null = null;
  if (
    o.pointer !== null &&
    typeof o.pointer === "object" &&
    o.pointer !== null
  ) {
    const p = o.pointer as Record<string, unknown>;
    if (typeof p.x === "number" && typeof p.y === "number") {
      pointer = { x: p.x, y: p.y };
    }
  }
  return {
    clientId: o.clientId,
    activeSpaceId: o.activeSpaceId,
    camera: { x: c.x, y: c.y, zoom: c.zoom },
    pointer,
    displayName,
    sigil,
    updatedAt: o.updatedAt,
  };
}

/** Heartbeat / pointer flush: one row per client in `canvas_presence`. */
export async function postPresencePayload(
  spaceId: string,
  clientId: string,
  payload: {
    camera: CameraState;
    pointer: { x: number; y: number } | null;
    displayName?: string | null;
    sigil?: PresenceSigilVariant | null;
  }
): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/spaces/${encodeURIComponent(spaceId)}/presence`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          camera: payload.camera,
          pointer: payload.pointer,
          displayName: payload.displayName ?? undefined,
          sigil: payload.sigil ?? undefined,
        }),
      }
    );
    const body = (await res.json()) as { ok?: boolean };
    return res.ok && body.ok === true;
  } catch {
    return false;
  }
}

/**
 * Fire-and-forget presence removal used on tab close (`pagehide`). Uses `keepalive: true` so the
 * request survives the document being unloaded — that is the whole reason this endpoint exists
 * instead of waiting for TTL prune.
 */
export function leavePresenceBeacon(spaceId: string, clientId: string): void {
  try {
    const url = `/api/spaces/${encodeURIComponent(spaceId)}/presence?clientId=${encodeURIComponent(clientId)}`;
    void fetch(url, { method: "DELETE", keepalive: true }).catch(() => {
      /* swallow — page is unloading; cannot recover anyway */
    });
  } catch {
    /* ignore */
  }
}

export async function fetchSpacePresencePeersDetail(
  spaceId: string,
  exceptClientId?: string,
  options?: { scope?: "local" | "subtree" }
): Promise<SpacePresencePeer[]> {
  try {
    const q = new URLSearchParams();
    if (exceptClientId != null && exceptClientId.length > 0) {
      q.set("except", exceptClientId);
    }
    if (options?.scope === "local") {
      q.set("scope", "local");
    }
    const qs = q.toString();
    const res = await fetch(
      `/api/spaces/${encodeURIComponent(spaceId)}/presence${qs ? `?${qs}` : ""}`
    );
    const body = (await res.json()) as { ok?: boolean; peers?: unknown[] };
    if (!(res.ok && body.ok && Array.isArray(body.peers))) {
      return [];
    }
    const out: SpacePresencePeer[] = [];
    for (const row of body.peers) {
      const p = parseSpacePresencePeer(row);
      if (p) {
        out.push(p);
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchSpacePresencePeers(
  spaceId: string,
  exceptClientId?: string
): Promise<number> {
  const peers = await fetchSpacePresencePeersDetail(spaceId, exceptClientId);
  return peers.length;
}

export async function apiCreateSpace(
  name: string,
  parentSpaceId: string | null,
  options?: { id?: string }
): Promise<{ ok: boolean; space?: { id: string }; error?: string }> {
  const track = getNeonSyncSnapshot().cloudEnabled;
  if (track) {
    neonSyncBeginRequest();
  }
  const op = "POST /api/spaces";
  try {
    const payload: Record<string, unknown> = { name, parentSpaceId };
    if (options?.id) {
      payload.id = options.id;
    }
    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const rawText = await res.text();
    const body = parseJsonBody(rawText) as {
      ok?: boolean;
      space?: { id: string };
      error?: string;
    };
    const logicalOk = res.ok && !!body.ok;
    finishNeonTrack(track, op, res, rawText, body, logicalOk);
    return { ok: logicalOk, space: body.space, error: body.error };
  } catch (e) {
    if (track) {
      neonSyncEndRequest(false, {
        operation: op,
        message: e instanceof Error ? e.message : "Network error",
        cause: "network",
      });
    }
    return { ok: false, error: "Network error" };
  }
}

export async function apiCreateItem(
  spaceId: string,
  bodyPayload: Record<string, unknown>
): Promise<{ ok: boolean; item?: CanvasItem; error?: string }> {
  const track = getNeonSyncSnapshot().cloudEnabled;
  if (track) {
    neonSyncBeginRequest();
  }
  const op = `POST /api/spaces/${spaceId}/items`;
  try {
    const res = await fetch(`/api/spaces/${spaceId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
    });
    const rawText = await res.text();
    const body = parseJsonBody(rawText) as {
      ok?: boolean;
      item?: CanvasItem;
      error?: string;
    };
    const logicalOk = res.ok && !!body.ok;
    finishNeonTrack(track, op, res, rawText, body, logicalOk);
    if (logicalOk && body.item?.id) {
      scheduleVaultIndexForItem(body.item.id);
    }
    return { ok: logicalOk, item: body.item, error: body.error };
  } catch (e) {
    if (track) {
      neonSyncEndRequest(false, {
        operation: op,
        message: e instanceof Error ? e.message : "Network error",
        cause: "network",
      });
    }
    return { ok: false, error: "Network error" };
  }
}

export async function apiPatchItem(
  itemId: string,
  patch: Record<string, unknown>
): Promise<ApiPatchItemResult> {
  return runSerializedItemPatch(itemId, async () => {
    const track = getNeonSyncSnapshot().cloudEnabled;
    if (track) {
      neonSyncBeginRequest();
    }
    const op = `PATCH /api/items/${itemId}`;
    const debug = isHeartgardenSyncDebugEnabled();
    const t0 =
      debug && typeof performance !== "undefined" ? performance.now() : 0;
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const rawText = await res.text();
      const body = parseJsonBody(rawText) as {
        ok?: boolean;
        error?: string;
        item?: CanvasItem;
      };

      if (debug && typeof performance !== "undefined") {
        heartgardenSyncDebugLog(`PATCH ${itemId}`, {
          ms: Math.round(performance.now() - t0),
          status: res.status,
          baseUpdatedAt:
            typeof patch.baseUpdatedAt === "string"
              ? patch.baseUpdatedAt
              : undefined,
        });
      }

      if (res.status === 404) {
        finishNeonTrack(track, op, res, rawText, body, false);
        return { ok: false, gone: true };
      }

      if (res.status === 409 && body.error === "conflict" && body.item) {
        if (track) {
          neonSyncEndRequest(false, {
            operation: op,
            message: "Edit conflict — server has a newer version",
            cause: "http",
            httpStatus: 409,
          });
        }
        recordItemPatchConflict();
        return { ok: false, conflict: true, item: body.item };
      }

      const logicalOk = res.ok && body.ok === true;
      finishNeonTrack(track, op, res, rawText, body, logicalOk);
      if (
        logicalOk &&
        (patch.title !== undefined ||
          patch.contentText !== undefined ||
          patch.contentJson !== undefined)
      ) {
        scheduleVaultIndexForItem(itemId);
      }
      if (logicalOk && body.item) {
        recordItemPatchOk();
        return { ok: true, item: body.item };
      }
      if (logicalOk) {
        return { ok: false, error: "Missing item in response" };
      }
      return {
        ok: false,
        error:
          typeof body.error === "string" ? body.error : `HTTP ${res.status}`,
      };
    } catch (e) {
      if (track) {
        neonSyncEndRequest(false, {
          operation: op,
          message: e instanceof Error ? e.message : "Network error",
          cause: "network",
        });
      }
      return { ok: false, error: "Network error" };
    }
  });
}

export async function apiDeleteItem(itemId: string): Promise<boolean> {
  const track = getNeonSyncSnapshot().cloudEnabled;
  if (track) {
    neonSyncBeginRequest();
  }
  const op = `DELETE /api/items/${itemId}`;
  try {
    const res = await fetch(`/api/items/${itemId}`, { method: "DELETE" });
    const rawText = await res.text();
    const body = parseJsonBody(rawText) as { ok?: boolean; error?: string };
    const logicalOk = res.ok && body.ok === true;
    finishNeonTrack(track, op, res, rawText, body, logicalOk);
    return logicalOk;
  } catch (e) {
    if (track) {
      neonSyncEndRequest(false, {
        operation: op,
        message: e instanceof Error ? e.message : "Network error",
        cause: "network",
      });
    }
    return false;
  }
}

/** Removes a folder child space and its descendants from Neon (items cascade). */
export async function apiDeleteSpaceSubtree(spaceId: string): Promise<boolean> {
  const track = getNeonSyncSnapshot().cloudEnabled;
  if (track) {
    neonSyncBeginRequest();
  }
  const op = `DELETE /api/spaces/${spaceId}`;
  try {
    const res = await fetch(`/api/spaces/${spaceId}`, { method: "DELETE" });
    const rawText = await res.text();
    const body = parseJsonBody(rawText) as { ok?: boolean; error?: string };
    const logicalOk = res.ok && body.ok === true;
    finishNeonTrack(track, op, res, rawText, body, logicalOk);
    return logicalOk;
  } catch (e) {
    if (track) {
      neonSyncEndRequest(false, {
        operation: op,
        message: e instanceof Error ? e.message : "Network error",
        cause: "network",
      });
    }
    return false;
  }
}

export async function apiPatchSpaceName(
  spaceId: string,
  name: string
): Promise<boolean> {
  const track = getNeonSyncSnapshot().cloudEnabled;
  if (track) {
    neonSyncBeginRequest();
  }
  const op = `PATCH /api/spaces/${spaceId} (name)`;
  try {
    const res = await fetch(`/api/spaces/${spaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const rawText = await res.text();
    const body = parseJsonBody(rawText) as { ok?: boolean; error?: string };
    const logicalOk = res.ok && body.ok === true;
    finishNeonTrack(track, op, res, rawText, body, logicalOk);
    return logicalOk;
  } catch (e) {
    if (track) {
      neonSyncEndRequest(false, {
        operation: op,
        message: e instanceof Error ? e.message : "Network error",
        cause: "network",
      });
    }
    return false;
  }
}

export async function apiPatchSpaceParent(
  spaceId: string,
  parentSpaceId: string | null
): Promise<boolean> {
  const track = getNeonSyncSnapshot().cloudEnabled;
  if (track) {
    neonSyncBeginRequest();
  }
  const op = `PATCH /api/spaces/${spaceId} (parentSpaceId)`;
  try {
    const res = await fetch(`/api/spaces/${spaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentSpaceId }),
    });
    const rawText = await res.text();
    const body = parseJsonBody(rawText) as { ok?: boolean; error?: string };
    const logicalOk = res.ok && body.ok === true;
    finishNeonTrack(track, op, res, rawText, body, logicalOk);
    return logicalOk;
  } catch (e) {
    if (track) {
      neonSyncEndRequest(false, {
        operation: op,
        message: e instanceof Error ? e.message : "Network error",
        cause: "network",
      });
    }
    return false;
  }
}
