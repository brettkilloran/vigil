"use client";

import { useCallback, useEffect, useState } from "react";

export type RecentPaletteItem = {
  id: string;
  title: string;
  itemType: string;
  spaceId: string;
  spaceName: string;
  updatedAt: number;
};

const LS_RECENT_ITEMS = "vigil-recent-items";
const MAX_RECENT_ITEMS = 20;

function readRecentItems(): RecentPaletteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_RECENT_ITEMS);
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

function writeRecentItems(items: RecentPaletteItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_RECENT_ITEMS, JSON.stringify(items.slice(0, MAX_RECENT_ITEMS)));
  } catch {
    /* ignore */
  }
}

export function useRecentItems() {
  const [items, setItems] = useState<RecentPaletteItem[]>([]);

  useEffect(() => {
    setItems(readRecentItems());
  }, []);

  const push = useCallback((entry: Omit<RecentPaletteItem, "updatedAt">) => {
    setItems((prev) => {
      const next: RecentPaletteItem[] = [
        { ...entry, updatedAt: Date.now() },
        ...prev.filter((row) => row.id !== entry.id),
      ].slice(0, MAX_RECENT_ITEMS);
      writeRecentItems(next);
      return next;
    });
  }, []);

  return { items, push };
}
