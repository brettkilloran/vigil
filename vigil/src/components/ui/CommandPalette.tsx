"use client";

import { Command } from "cmdk";
import {
  ClockCounterClockwise,
  FileText,
  Folder,
  Globe,
  ImageSquare,
  ListChecks,
  MagnifyingGlass,
  NotePencil,
  PlusCircle,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { RecentPaletteItem } from "@/src/hooks/use-recent-items";

export type PaletteItem = {
  id: string;
  title: string;
  itemType: string;
  spaceId: string;
  spaceName: string;
  entityType?: string | null;
  snippet?: string;
  updatedAt?: string | number | Date | null;
};

export type PaletteSpace = {
  id: string;
  name: string;
  pathLabel?: string;
};

export type PaletteAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  hint?: string;
  keywords?: string[];
};

const iconCls = "size-4 shrink-0 opacity-60";

function iconForItemType(itemType: string): ReactNode {
  switch (itemType) {
    case "note":
      return <FileText className={iconCls} weight="bold" />;
    case "sticky":
      return <NotePencil className={iconCls} weight="bold" />;
    case "image":
      return <ImageSquare className={iconCls} weight="bold" />;
    case "checklist":
      return <ListChecks className={iconCls} weight="bold" />;
    case "webclip":
      return <Globe className={iconCls} weight="bold" />;
    case "folder":
      return <Folder className={iconCls} weight="bold" />;
    default:
      return <FileText className={iconCls} weight="bold" />;
  }
}

export function CommandPalette({
  open,
  onClose,
  currentSpaceId,
  items,
  spaces,
  actions,
  recentItems,
  onSelectItem,
  onSelectSpace,
  onRecordRecentItem,
  onRunAction,
}: {
  open: boolean;
  onClose: () => void;
  currentSpaceId: string | null;
  items: PaletteItem[];
  spaces: PaletteSpace[];
  actions: PaletteAction[];
  recentItems: RecentPaletteItem[];
  onSelectItem: (id: string) => void;
  onSelectSpace: (spaceId: string) => void;
  onRecordRecentItem: (item: Omit<RecentPaletteItem, "updatedAt">) => void;
  onRunAction: (actionId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<PaletteItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQ("");
      setRemote([]);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 2) {
      setRemote([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, mode: "hybrid" });
        if (currentSpaceId) params.set("spaceId", currentSpaceId);
        const res = await fetch(`/api/search/suggest?${params}`);
        const data = (await res.json()) as {
          ok?: boolean;
          suggestions?: PaletteItem[];
        };
        if (cancelled) return;
        if (data.ok && Array.isArray(data.suggestions)) {
          setRemote(data.suggestions);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, q, currentSpaceId]);

  const qq = q.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    if (!qq) return [];
    return items
      .filter((it) => {
        const hay =
          `${it.title} ${it.snippet ?? ""} ${it.spaceName}`.toLowerCase();
        return hay.includes(qq);
      })
      .slice(0, 20);
  }, [items, qq]);

  const allItems = useMemo(() => {
    const seen = new Set<string>();
    const result: (PaletteItem & { source: "local" | "remote" })[] = [];
    for (const it of filteredItems) {
      if (!seen.has(it.id)) {
        seen.add(it.id);
        result.push({ ...it, source: "local" });
      }
    }
    for (const it of remote) {
      if (!seen.has(it.id)) {
        seen.add(it.id);
        result.push({ ...it, source: "remote" });
      }
    }
    return result;
  }, [filteredItems, remote]);

  const recentFiltered = useMemo(() => {
    if (qq) return [];
    return recentItems.slice(0, 8);
  }, [recentItems, qq]);

  const filteredSpaces = useMemo(() => {
    return spaces
      .filter((s) => {
        if (!qq) return true;
        return `${s.name} ${s.pathLabel ?? ""}`
          .toLowerCase()
          .includes(qq);
      })
      .slice(0, qq ? 8 : 5);
  }, [spaces, qq]);

  const filteredActions = useMemo(() => {
    return actions
      .filter((a) => {
        if (!qq) return true;
        const hay =
          `${a.label} ${a.keywords?.join(" ") ?? ""}`.toLowerCase();
        return hay.includes(qq);
      })
      .slice(0, qq ? 8 : 6);
  }, [actions, qq]);

  const selectItem = useCallback(
    (item: PaletteItem) => {
      onRecordRecentItem({
        id: item.id,
        title: item.title,
        itemType: item.itemType,
        spaceId: item.spaceId,
        spaceName: item.spaceName,
      });
      onSelectItem(item.id);
      onClose();
    },
    [onClose, onRecordRecentItem, onSelectItem],
  );

  const selectSpace = useCallback(
    (spaceId: string) => {
      onSelectSpace(spaceId);
      onClose();
    },
    [onClose, onSelectSpace],
  );

  const runAction = useCallback(
    (actionId: string) => {
      onRunAction(actionId);
      onClose();
    },
    [onClose, onRunAction],
  );

  const hasResults =
    recentFiltered.length > 0 ||
    allItems.length > 0 ||
    filteredSpaces.length > 0 ||
    filteredActions.length > 0;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      label="Command palette"
      shouldFilter={false}
      loop
    >
      <div cmdk-input-wrapper="">
        <MagnifyingGlass
          className="size-4 shrink-0 opacity-50"
          weight="bold"
        />
        <Command.Input
          value={q}
          onValueChange={setQ}
          placeholder="Search items, spaces, actions..."
        />
        <kbd className="cmdk-kbd">ESC</kbd>
      </div>

      <Command.List>
        {loading && (
          <Command.Loading>Searching…</Command.Loading>
        )}

        {!hasResults && <Command.Empty>No results found.</Command.Empty>}

        {recentFiltered.length > 0 && (
          <Command.Group heading="Recent">
            {recentFiltered.map((item) => (
              <Command.Item
                key={`recent-${item.id}`}
                value={`recent-${item.id}`}
                onSelect={() => selectItem(item)}
              >
                {iconForItemType(item.itemType)}
                <div className="cmdk-item-content">
                  <span>{item.title}</span>
                  <span className="cmdk-item-meta">{item.spaceName}</span>
                </div>
                <ClockCounterClockwise className="size-3.5 opacity-40 ml-auto shrink-0" />
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {allItems.length > 0 && (
          <Command.Group heading="Results">
            {allItems.map((item) => (
              <Command.Item
                key={`item-${item.id}`}
                value={`item-${item.id}`}
                onSelect={() => selectItem(item)}
              >
                {iconForItemType(item.itemType)}
                <div className="cmdk-item-content">
                  <span>{item.title}</span>
                  <span className="cmdk-item-meta">
                    {item.itemType} · {item.spaceName}
                  </span>
                  {item.snippet && (
                    <span className="cmdk-item-snippet">{item.snippet}</span>
                  )}
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {filteredSpaces.length > 0 && (
          <Command.Group heading="Spaces">
            {filteredSpaces.map((space) => (
              <Command.Item
                key={`space-${space.id}`}
                value={`space-${space.id}`}
                onSelect={() => selectSpace(space.id)}
              >
                <Folder className={iconCls} weight="bold" />
                <div className="cmdk-item-content">
                  <span>{space.name}</span>
                  {space.pathLabel && (
                    <span className="cmdk-item-meta">{space.pathLabel}</span>
                  )}
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {filteredActions.length > 0 && (
          <Command.Group heading="Actions">
            {filteredActions.map((action) => (
              <Command.Item
                key={`action-${action.id}`}
                value={`action-${action.id}`}
                onSelect={() => runAction(action.id)}
              >
                {action.icon ?? (
                  <PlusCircle className={iconCls} weight="bold" />
                )}
                <div className="cmdk-item-content">
                  <span>{action.label}</span>
                  {action.hint && (
                    <span className="cmdk-item-meta">{action.hint}</span>
                  )}
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
