import type { BootstrapResponse } from "@/src/components/foundation/architectural-db-bridge";
import type { CanvasItem } from "@/src/model/canvas-types";
import {
  getNeonSyncSnapshot,
  neonSyncBeginRequest,
  neonSyncEndRequest,
} from "@/src/lib/neon-sync-bus";
import { parseJsonBody, syncFailureFromApiResponse } from "@/src/lib/sync-error-diagnostic";

const vaultIndexTimers = new Map<string, ReturnType<typeof setTimeout>>();
const VAULT_INDEX_DEBOUNCE_MS = 2800;

function scheduleVaultIndexForItem(itemId: string) {
  const prev = vaultIndexTimers.get(itemId);
  if (prev) clearTimeout(prev);
  const t = setTimeout(() => {
    vaultIndexTimers.delete(itemId);
    void fetch(`/api/items/${encodeURIComponent(itemId)}/index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => {
      /* non-fatal */
    });
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

export async function fetchBootstrap(spaceId?: string): Promise<BootstrapResponse | null> {
  const q = spaceId ? `?space=${encodeURIComponent(spaceId)}` : "";
  const res = await fetch(`/api/bootstrap${q}`);
  const data = (await res.json()) as BootstrapResponse;
  return data.ok ? data : null;
}

export async function apiCreateSpace(
  name: string,
  parentSpaceId: string | null,
): Promise<{ ok: boolean; space?: { id: string }; error?: string }> {
  const track = getNeonSyncSnapshot().cloudEnabled;
  if (track) neonSyncBeginRequest();
  const op = "POST /api/spaces";
  try {
    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentSpaceId }),
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
): Promise<boolean> {
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
    const body = parseJsonBody(rawText) as { ok?: boolean; error?: string };
    const logicalOk = res.ok && body.ok === true;
    finishNeonTrack(track, op, res, rawText, body, logicalOk);
    if (logicalOk && (patch.title !== undefined || patch.contentText !== undefined)) {
      scheduleVaultIndexForItem(itemId);
    }
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

export async function apiPatchSpaceCamera(
  spaceId: string,
  camera: { x: number; y: number; zoom: number },
): Promise<boolean> {
  const track = getNeonSyncSnapshot().cloudEnabled;
  if (track) neonSyncBeginRequest();
  const op = `PATCH /api/spaces/${spaceId} (camera)`;
  try {
    const res = await fetch(`/api/spaces/${spaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ camera }),
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
