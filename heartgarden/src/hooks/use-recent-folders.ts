"use client";

import { useCallback, useEffect, useState } from "react";

import type { WorkspaceBootTierTag } from "@/src/lib/workspace-view-cache";

/** Folder entities the user has opened (entered child space), for Cmd+K quick access. */
export type RecentPaletteFolder = {
  id: string;
  title: string;
  parentSpaceId: string;
  parentSpaceName: string;
  updatedAt: number;
};

const MAX_RECENT_FOLDERS = 20;

function storageKeyForTier(tier: WorkspaceBootTierTag): string {
  return `vigil-recent-folders-v2:${tier}`;
}

function readRecentFolders(tier: WorkspaceBootTierTag): RecentPaletteFolder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKeyForTier(tier));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is RecentPaletteFolder => {
        if (!entry || typeof entry !== "object") return false;
        const row = entry as Record<string, unknown>;
        return (
          typeof row.id === "string" &&
          typeof row.title === "string" &&
          typeof row.parentSpaceId === "string" &&
          typeof row.parentSpaceName === "string" &&
          typeof row.updatedAt === "number"
        );
      })
      .slice(0, MAX_RECENT_FOLDERS);
  } catch {
    return [];
  }
}

function writeRecentFolders(tier: WorkspaceBootTierTag, items: RecentPaletteFolder[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKeyForTier(tier),
      JSON.stringify(items.slice(0, MAX_RECENT_FOLDERS)),
    );
  } catch {
    /* ignore */
  }
}

export function useRecentFolders(tier: WorkspaceBootTierTag) {
  const [items, setItems] = useState<RecentPaletteFolder[]>(() => readRecentFolders(tier));

  useEffect(() => {
    setItems(readRecentFolders(tier));
  }, [tier]);

  const push = useCallback(
    (entry: Omit<RecentPaletteFolder, "updatedAt">) => {
      setItems((prev) => {
        const next: RecentPaletteFolder[] = [
          { ...entry, updatedAt: Date.now() },
          ...prev.filter((row) => row.id !== entry.id),
        ].slice(0, MAX_RECENT_FOLDERS);
        writeRecentFolders(tier, next);
        return next;
      });
    },
    [tier],
  );

  const pruneIds = useCallback(
    (ids: ReadonlySet<string>) => {
      if (ids.size === 0) return;
      setItems((prev) => {
        const next = prev.filter((row) => !ids.has(row.id));
        if (next.length === prev.length) return prev;
        writeRecentFolders(tier, next);
        return next;
      });
    },
    [tier],
  );

  return { items, push, pruneIds };
}
