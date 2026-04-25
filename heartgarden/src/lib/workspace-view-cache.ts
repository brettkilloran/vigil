import type { BootstrapResponse } from "@/src/components/foundation/architectural-db-bridge";

/** v1 legacy key — cleared on `clearWorkspaceViewCache`. */
const LEGACY_STORAGE_KEY = "heartgarden-workspace-view-v1";

/** Current cache blob (includes tier so GM / Players snapshots do not mix). */
export const WORKSPACE_VIEW_CACHE_STORAGE_KEY = "heartgarden-workspace-view-v2";

export type WorkspaceBootTierTag = "access" | "player" | "open";

export type WorkspaceViewCachePayload = {
  v: 2;
  savedAt: number;
  maxZIndex: number;
  /** Session tier when cached (`open` = gate off / legacy). */
  bootTier: WorkspaceBootTierTag;
  bootstrap: BootstrapResponse;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function parseBootstrap(boot: unknown): BootstrapResponse | null {
  if (!isRecord(boot)) {
    return null;
  }
  if (boot.ok !== true) {
    return null;
  }
  if (boot.demo !== false) {
    return null;
  }
  if (typeof boot.spaceId !== "string" || !boot.spaceId) {
    return null;
  }
  if (!(Array.isArray(boot.spaces) && Array.isArray(boot.items))) {
    return null;
  }
  return boot as BootstrapResponse;
}

/**
 * @param expectedBootTier — when set, reject cache written under a different tier (GM vs Players).
 */
export function readWorkspaceViewCache(
  expectedBootTier?: WorkspaceBootTierTag | null
): WorkspaceViewCachePayload | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    const raw = window.localStorage.getItem(WORKSPACE_VIEW_CACHE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return null;
    }
    if (parsed.v !== 2) {
      return null;
    }
    if (typeof parsed.savedAt !== "number") {
      return null;
    }
    if (typeof parsed.maxZIndex !== "number" || parsed.maxZIndex < 1) {
      return null;
    }
    if (
      parsed.bootTier !== "access" &&
      parsed.bootTier !== "player" &&
      parsed.bootTier !== "visitor" &&
      parsed.bootTier !== "open"
    ) {
      return null;
    }
    const bootTier: WorkspaceBootTierTag =
      parsed.bootTier === "visitor"
        ? "player"
        : (parsed.bootTier as WorkspaceBootTierTag);
    if (expectedBootTier != null && expectedBootTier !== bootTier) {
      return null;
    }
    const boot = parseBootstrap(parsed.bootstrap);
    if (!boot) {
      return null;
    }
    return {
      v: 2,
      savedAt: parsed.savedAt,
      maxZIndex: parsed.maxZIndex,
      bootTier,
      bootstrap: boot,
    };
  } catch {
    return null;
  }
}

export function writeWorkspaceViewCache(
  bootstrap: BootstrapResponse,
  maxZIndex: number,
  bootTier: WorkspaceBootTierTag
): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!bootstrap.spaceId || bootstrap.demo !== false) {
    return;
  }
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    const payload: WorkspaceViewCachePayload = {
      v: 2,
      savedAt: Date.now(),
      maxZIndex,
      bootTier,
      bootstrap,
    };
    window.localStorage.setItem(
      WORKSPACE_VIEW_CACHE_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearWorkspaceViewCache(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(WORKSPACE_VIEW_CACHE_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
