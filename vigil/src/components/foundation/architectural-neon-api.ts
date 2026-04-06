import type { BootstrapResponse } from "@/src/components/foundation/architectural-db-bridge";
import type { CameraState, CanvasItem } from "@/src/model/canvas-types";
import {
  getNeonSyncSnapshot,
  neonSyncBeginRequest,
  neonSyncEndRequest,
} from "@/src/lib/neon-sync-bus";
import { parseJsonBody, syncFailureFromApiResponse } from "@/src/lib/sync-error-diagnostic";
import {
  vaultIndexClearInFlight,
  vaultIndexClearPending,
  vaultIndexMarkInFlight,
  vaultIndexMarkPending,
  vaultIndexSetError,
} from "@/src/lib/vault-index-status-bus";

const vaultIndexTimers = new Map<string, ReturnType<typeof setTimeout>>();
const VAULT_INDEX_DEBOUNCE_MS = 2800;

function scheduleVaultIndexForItem(itemId: string) {
  const prev = vaultIndexTimers.get(itemId);
  if (prev) clearTimeout(prev);
  vaultIndexMarkPending(itemId);
  const t = setTimeout(() => {
    vaultIndexTimers.delete(itemId);
    vaultIndexClearPending(itemId);
    vaultIndexMarkInFlight(itemId);
    void (async () => {
      try {
        const res = await fetch(`/api/items/${encodeURIComponent(itemId)}/index`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const rawText = await res.text();
        let body: Record<string, unknown> = {};
        try {
          body = rawText.trim() ? (JSON.parse(rawText) as Record<string, unknown>) : {};
        } catch {
          body = {};
        }
        if (res.status === 429) {
          vaultIndexSetError("Search index rate limited — try again shortly.");
        } else if (!res.ok) {
          const err =
            typeof body.error === "string"
              ? body.error
              : `Index failed (${res.status})`;
          vaultIndexSetError(err);
        } else if (body.ok !== true) {
          vaultIndexSetError(typeof body.error === "string" ? body.error : "Index did not complete.");
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
  logicalOk: boolean,
) {
  if (!track) return;
  if (logicalOk) {
    neonSyncEndRequest(true);
    return;
  }
  const detail = syncFailureFromApiResponse(operation, res, rawText, body, logicalOk);
  neonSyncEndRequest(
    false,
    detail ?? {
      operation,
      httpStatus: res.status,
      message: `HTTP ${res.status}`,
      cause: "http",
    },
  );
}

const itemPatchChains = new Map<string, Promise<unknown>>();

function runSerializedItemPatch<T>(itemId: string, fn: () => Promise<T>): Promise<T> {
  const prev = itemPatchChains.get(itemId) ?? Promise.resolve();
  const chained = prev.then(
    () => fn(),
    () => fn(),
  );
  const wrapped = chained.finally(() => {
    if (itemPatchChains.get(itemId) === wrapped) itemPatchChains.delete(itemId);
  });
  itemPatchChains.set(itemId, wrapped);
  return chained;
}

export type ApiPatchItemResult =
  | { ok: true; item: CanvasItem }
  | { ok: false; conflict: true; item: CanvasItem }
  | { ok: false; gone: true }
  | { ok: false; error?: string };

export async function fetchBootstrap(spaceId?: string): Promise<BootstrapResponse | null> {
  const q = spaceId ? `?space=${encodeURIComponent(spaceId)}` : "";
  const res = await fetch(`/api/bootstrap${q}`);
  const data = (await res.json()) as BootstrapResponse;
  return data.ok ? data : null;
}

export type SpaceChangePayloadRow = {
  id: string;
  name: string;
  parentSpaceId: string | null;
  updatedAt?: string;
};

export type SpaceChangesResponse = {
  ok: boolean;
  items?: CanvasItem[];
  /** Subtree `spaces` rows updated since `since` (e.g. reparent / rename). */
  spaces?: SpaceChangePayloadRow[];
  itemIds?: string[];
  cursor?: string;
  error?: string;
};

export async function fetchSpaceChanges(
  spaceId: string,
  since: string,
  options?: { includeItemIds?: boolean },
): Promise<SpaceChangesResponse | null> {
  try {
    const q = new URLSearchParams();
    q.set("since", since);
    if (options?.includeItemIds) q.set("includeItemIds", "1");
    const res = await fetch(
      `/api/spaces/${encodeURIComponent(spaceId)}/changes?${q.toString()}`,
    );
    const data = (await res.json()) as SpaceChangesResponse;
    return res.ok && data.ok ? data : null;
  } catch {
    return null;
  }
}

export type SpacePresencePeer = {
  clientId: string;
  activeSpaceId: string;
  camera: CameraState;
  pointer: { x: number; y: number } | null;
  updatedAt: string;
};

function parseSpacePresencePeer(raw: unknown): SpacePresencePeer | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.clientId !== "string" || typeof o.activeSpaceId !== "string") return null;
  if (typeof o.updatedAt !== "string") return null;
  const cam = o.camera;
  if (typeof cam !== "object" || cam === null) return null;
  const c = cam as Record<string, unknown>;
  if (typeof c.x !== "number" || typeof c.y !== "number" || typeof c.zoom !== "number") return null;
  let pointer: { x: number; y: number } | null = null;
  if (o.pointer !== null && typeof o.pointer === "object" && o.pointer !== null) {
    const p = o.pointer as Record<string, unknown>;
    if (typeof p.x === "number" && typeof p.y === "number") pointer = { x: p.x, y: p.y };
  }
  return {
    clientId: o.clientId,
    activeSpaceId: o.activeSpaceId,
    camera: { x: c.x, y: c.y, zoom: c.zoom },
    pointer,
    updatedAt: o.updatedAt,
  };
}

/** Heartbeat / pointer flush: one row per client in `canvas_presence`. */
export async function postPresencePayload(
  spaceId: string,
  clientId: string,
  payload: { camera: CameraState; pointer: { x: number; y: number } | null },
): Promise<boolean> {
  try {
    const res = await fetch(`/api/spaces/${encodeURIComponent(spaceId)}/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        camera: payload.camera,
        pointer: payload.pointer,
      }),
    });
    const body = (await res.json()) as { ok?: boolean };
    return res.ok && body.ok === true;
  } catch {
    return false;
  }
}

export async function fetchSpacePresencePeersDetail(
  spaceId: string,
  exceptClientId?: string,
  options?: { scope?: "local" | "subtree" },
): Promise<SpacePresencePeer[]> {
  try {
    const q = new URLSearchParams();
    if (exceptClientId != null && exceptClientId.length > 0) {
      q.set("except", exceptClientId);
    }
    if (options?.scope === "local") q.set("scope", "local");
    const qs = q.toString();
    const res = await fetch(
      `/api/spaces/${encodeURIComponent(spaceId)}/presence${qs ? `?${qs}` : ""}`,
    );
    const body = (await res.json()) as { ok?: boolean; peers?: unknown[] };
    if (!res.ok || !body.ok || !Array.isArray(body.peers)) return [];
    const out: SpacePresencePeer[] = [];
    for (const row of body.peers) {
      const p = parseSpacePresencePeer(row);
      if (p) out.push(p);
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchSpacePresencePeers(
  spaceId: string,
  exceptClientId?: string,
): Promise<number> {
  const peers = await fetchSpacePresencePeersDetail(spaceId, exceptClientId);
  return peers.length;
}

export async function apiCreateSpace(
  name: string,
  parentSpaceId: string | null,
  options?: { id?: string },
): Promise<{ ok: boolean; space?: { id: string }; error?: string }> {
  const track = getNeonSyncSnapshot().cloudEnabled;
  if (track) neonSyncBeginRequest();
  const op = "POST /api/spaces";
  try {
    const payload: Record<string, unknown> = { name, parentSpaceId };
    if (options?.id) payload.id = options.id;
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
  bodyPayload: Record<string, unknown>,
): Promise<{ ok: boolean; item?: CanvasItem; error?: string }> {
  const track = getNeonSyncSnapshot().cloudEnabled;
  if (track) neonSyncBeginRequest();
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
  patch: Record<string, unknown>,
): Promise<ApiPatchItemResult> {
  return runSerializedItemPatch(itemId, async () => {
    const track = getNeonSyncSnapshot().cloudEnabled;
    if (track) neonSyncBeginRequest();
    const op = `PATCH /api/items/${itemId}`;
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

      if (res.status === 404) {
        finishNeonTrack(track, op, res, rawText, body, false);
        return { ok: false, gone: true };
      }

      if (res.status === 409 && body.error === "conflict" && body.item) {
        if (track) neonSyncEndRequest(true);
        return { ok: false, conflict: true, item: body.item };
      }

      const logicalOk = res.ok && body.ok === true;
      finishNeonTrack(track, op, res, rawText, body, logicalOk);
      if (logicalOk && (patch.title !== undefined || patch.contentText !== undefined)) {
        scheduleVaultIndexForItem(itemId);
      }
      if (logicalOk && body.item) {
        return { ok: true, item: body.item };
      }
      if (logicalOk) {
        return { ok: false, error: "Missing item in response" };
      }
      return { ok: false, error: typeof body.error === "string" ? body.error : `HTTP ${res.status}` };
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
  if (track) neonSyncBeginRequest();
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
  if (track) neonSyncBeginRequest();
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

export async function apiPatchSpaceName(spaceId: string, name: string): Promise<boolean> {
  const track = getNeonSyncSnapshot().cloudEnabled;
  if (track) neonSyncBeginRequest();
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
  parentSpaceId: string | null,
): Promise<boolean> {
  const track = getNeonSyncSnapshot().cloudEnabled;
  if (track) neonSyncBeginRequest();
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
