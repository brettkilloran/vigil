"use client";

import { useCallback, useEffect, useState } from "react";

import type { WorkspaceBootTierTag } from "@/src/lib/workspace-view-cache";

export type RecentPaletteItem = {
  id: string;
  title: string;
  itemType: string;
  spaceId: string;
  spaceName: string;
  updatedAt: number;
};

const MAX_RECENT_ITEMS = 20;

function storageKeyForTier(tier: WorkspaceBootTierTag): string {
  return `vigil-recent-items-v2:${tier}`;
}

function readRecentItems(tier: WorkspaceBootTierTag): RecentPaletteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKeyForTier(tier));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is RecentPaletteItem => {
        if (!entry || typeof entry !== "object") return false;
        const row = entry as Record<string, unknown>;
        return (
          typeof row.id === "string" &&
          typeof row.title === "string" &&
          typeof row.itemType === "string" &&
          typeof row.spaceId === "string" &&
          typeof row.spaceName === "string" &&
          typeof row.updatedAt === "number"
        );
      })
      .slice(0, MAX_RECENT_ITEMS);
  } catch {
    return [];
  }
}

function writeRecentItems(tier: WorkspaceBootTierTag, items: RecentPaletteItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKeyForTier(tier),
      JSON.stringify(items.slice(0, MAX_RECENT_ITEMS)),
    );
  } catch {
    /* ignore */
  }
}

export function useRecentItems(tier: WorkspaceBootTierTag) {
  const [items, setItems] = useState<RecentPaletteItem[]>(() => readRecentItems(tier));

  useEffect(() => {
    setItems(readRecentItems(tier));
  }, [tier]);

  const push = useCallback(
    (entry: Omit<RecentPaletteItem, "updatedAt">) => {
      setItems((prev) => {
        const next: RecentPaletteItem[] = [
          { ...entry, updatedAt: Date.now() },
          ...prev.filter((row) => row.id !== entry.id),
        ].slice(0, MAX_RECENT_ITEMS);
        writeRecentItems(tier, next);
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
        writeRecentItems(tier, next);
        return next;
      });
    },
    [tier],
  );

  return { items, push, pruneIds };
}
