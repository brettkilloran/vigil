import type { BootstrapResponse } from "@/src/components/foundation/architectural-db-bridge";
import type { CanvasItem } from "@/src/stores/canvas-types";

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
  const res = await fetch("/api/spaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parentSpaceId }),
  });
  return res.json() as Promise<{ ok: boolean; space?: { id: string }; error?: string }>;
}

export async function apiCreateItem(
  spaceId: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; item?: CanvasItem; error?: string }> {
  const res = await fetch(`/api/spaces/${spaceId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ ok: boolean; item?: CanvasItem; error?: string }>;
}

export async function apiPatchItem(
  itemId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const res = await fetch(`/api/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return res.ok;
}

export async function apiDeleteItem(itemId: string): Promise<boolean> {
  const res = await fetch(`/api/items/${itemId}`, { method: "DELETE" });
  return res.ok;
}

export async function apiPatchSpaceCamera(
  spaceId: string,
  camera: { x: number; y: number; zoom: number },
): Promise<boolean> {
  const res = await fetch(`/api/spaces/${spaceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ camera }),
  });
  return res.ok;
}

export async function apiPatchSpaceName(spaceId: string, name: string): Promise<boolean> {
  const res = await fetch(`/api/spaces/${spaceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.ok;
}
