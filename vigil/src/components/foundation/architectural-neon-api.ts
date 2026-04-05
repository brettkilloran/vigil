import type { BootstrapResponse } from "@/src/components/foundation/architectural-db-bridge";
import type { CanvasItem } from "@/src/model/canvas-types";
import {
  getNeonSyncSnapshot,
  neonSyncBeginRequest,
  neonSyncEndRequest,
} from "@/src/lib/neon-sync-bus";

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
  try {
    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentSpaceId }),
    });
    const data = (await res.json()) as { ok: boolean; space?: { id: string }; error?: string };
    const ok = res.ok && !!data.ok;
    if (track) neonSyncEndRequest(ok, ok ? undefined : data.error ?? `HTTP ${res.status}`);
    return data;
  } catch (e) {
    if (track) neonSyncEndRequest(false, e instanceof Error ? e.message : "Network error");
    return { ok: false, error: "Network error" };
  }
}

export async function apiCreateItem(
  spaceId: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; item?: CanvasItem; error?: string }> {
  const track = getNeonSyncSnapshot().cloudEnabled;
  if (track) neonSyncBeginRequest();
  try {
    const res = await fetch(`/api/spaces/${spaceId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; item?: CanvasItem; error?: string };
    const ok = res.ok && !!data.ok;
    if (track) neonSyncEndRequest(ok, ok ? undefined : data.error ?? `HTTP ${res.status}`);
    if (ok && data.item?.id) {
      scheduleVaultIndexForItem(data.item.id);
    }
    return data;
  } catch (e) {
    if (track) neonSyncEndRequest(false, e instanceof Error ? e.message : "Network error");
    return { ok: false, error: "Network error" };
  }
}

export async function apiPatchItem(
  itemId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const track = getNeonSyncSnapshot().cloudEnabled;
  if (track) neonSyncBeginRequest();
  try {
    const res = await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const ok = res.ok;
    if (track) neonSyncEndRequest(ok, ok ? undefined : `HTTP ${res.status}`);
    if (ok && (patch.title !== undefined || patch.contentText !== undefined)) {
      scheduleVaultIndexForItem(itemId);
    }
    return ok;
  } catch (e) {
    if (track) neonSyncEndRequest(false, e instanceof Error ? e.message : "Network error");
    return false;
  }
}

export async function apiDeleteItem(itemId: string): Promise<boolean> {
  const track = getNeonSyncSnapshot().cloudEnabled;
  if (track) neonSyncBeginRequest();
  try {
    const res = await fetch(`/api/items/${itemId}`, { method: "DELETE" });
    const ok = res.ok;
    if (track) neonSyncEndRequest(ok, ok ? undefined : `HTTP ${res.status}`);
    return ok;
  } catch (e) {
    if (track) neonSyncEndRequest(false, e instanceof Error ? e.message : "Network error");
    return false;
  }
}

/** Removes a folder child space and its descendants from Neon (items cascade). */
export async function apiDeleteSpaceSubtree(spaceId: string): Promise<boolean> {
  const track = getNeonSyncSnapshot().cloudEnabled;
  if (track) neonSyncBeginRequest();
  try {
    const res = await fetch(`/api/spaces/${spaceId}`, { method: "DELETE" });
    const ok = res.ok;
    if (track) neonSyncEndRequest(ok, ok ? undefined : `HTTP ${res.status}`);
    return ok;
  } catch (e) {
    if (track) neonSyncEndRequest(false, e instanceof Error ? e.message : "Network error");
    return false;
  }
}

export async function apiPatchSpaceCamera(
  spaceId: string,
  camera: { x: number; y: number; zoom: number },
): Promise<boolean> {
  const track = getNeonSyncSnapshot().cloudEnabled;
  if (track) neonSyncBeginRequest();
  try {
    const res = await fetch(`/api/spaces/${spaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ camera }),
    });
    const ok = res.ok;
    if (track) neonSyncEndRequest(ok, ok ? undefined : `HTTP ${res.status}`);
    return ok;
  } catch (e) {
    if (track) neonSyncEndRequest(false, e instanceof Error ? e.message : "Network error");
    return false;
  }
}

export async function apiPatchSpaceName(spaceId: string, name: string): Promise<boolean> {
  const track = getNeonSyncSnapshot().cloudEnabled;
  if (track) neonSyncBeginRequest();
  try {
    const res = await fetch(`/api/spaces/${spaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const ok = res.ok;
    if (track) neonSyncEndRequest(ok, ok ? undefined : `HTTP ${res.status}`);
    return ok;
  } catch (e) {
    if (track) neonSyncEndRequest(false, e instanceof Error ? e.message : "Network error");
    return false;
  }
}
