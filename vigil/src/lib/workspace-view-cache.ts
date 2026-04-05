import type { BootstrapResponse } from "@/src/components/foundation/architectural-db-bridge";

/** Last successful Neon bootstrap payload for instant “connected” UI when offline (same browser). */
export const WORKSPACE_VIEW_CACHE_STORAGE_KEY = "heartgarden-workspace-view-v1";

export type WorkspaceViewCachePayload = {
  v: 1;
  savedAt: number;
  maxZIndex: number;
  bootstrap: BootstrapResponse;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function readWorkspaceViewCache(): WorkspaceViewCachePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_VIEW_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (parsed.v !== 1) return null;
    if (typeof parsed.savedAt !== "number") return null;
    if (typeof parsed.maxZIndex !== "number" || parsed.maxZIndex < 1) return null;
    const boot = parsed.bootstrap;
    if (!isRecord(boot)) return null;
    if (boot.ok !== true) return null;
    if (boot.demo !== false) return null;
    if (typeof boot.spaceId !== "string" || !boot.spaceId) return null;
    if (!Array.isArray(boot.spaces) || !Array.isArray(boot.items)) return null;
    return parsed as WorkspaceViewCachePayload;
  } catch {
    return null;
  }
}

export function writeWorkspaceViewCache(
  bootstrap: BootstrapResponse,
  maxZIndex: number,
): void {
  if (typeof window === "undefined") return;
  if (!bootstrap.spaceId || bootstrap.demo !== false) return;
  try {
    const payload: WorkspaceViewCachePayload = {
      v: 1,
      savedAt: Date.now(),
      maxZIndex,
      bootstrap,
    };
    window.localStorage.setItem(WORKSPACE_VIEW_CACHE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}
