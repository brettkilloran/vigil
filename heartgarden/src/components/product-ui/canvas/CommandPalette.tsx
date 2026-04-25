"use client";

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
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/src/components/ui/Button";
import type { RecentPaletteFolder } from "@/src/hooks/use-recent-folders";
import type { RecentPaletteItem } from "@/src/hooks/use-recent-items";
import { getVigilPortalRoot } from "@/src/lib/dom-portal-root";

export interface PaletteItem {
  entityType?: string | null;
  id: string;
  itemType: string;
  snippet?: string;
  spaceId: string;
  spaceName: string;
  title: string;
  updatedAt?: string | number | Date | null;
}

export interface PaletteSpace {
  id: string;
  name: string;
  pathLabel?: string;
}

export interface PaletteAction {
  hint?: string;
  icon?: ReactNode;
  id: string;
  keywords?: string[];
  label: string;
}

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
  recentFolders,
  onSelectItem,
  onSelectSpace,
  onRecordRecentItem,
  onOpenRecentFolder,
  onRunAction,
}: {
  open: boolean;
  onClose: () => void;
  currentSpaceId: string | null;
  items: PaletteItem[];
  spaces: PaletteSpace[];
  actions: PaletteAction[];
  recentItems: RecentPaletteItem[];
  recentFolders: RecentPaletteFolder[];
  onSelectItem: (id: string, openInFocus?: boolean) => void;
  onSelectSpace: (spaceId: string) => void;
  onRecordRecentItem: (item: Omit<RecentPaletteItem, "updatedAt">) => void;
  onOpenRecentFolder: (folderId: string) => void;
  onRunAction: (actionId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<PaletteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const inputId = useId();

  useEffect(() => {
    if (!open) {
      setQ("");
      setRemote([]);
      setLoading(false);
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  /** Stop page/canvas from scrolling while the palette is open. */
  useEffect(() => {
    if (!open) {
      return;
    }
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [open]);

  /**
   * Wheel/touch outside the palette panel, or overscroll past the results list,
   * must not reach the canvas behind the portal.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    const onWheel = (e: WheelEvent) => {
      const root = rootRef.current;
      const list = listRef.current;
      const t = e.target;
      if (!(root && t instanceof Node)) {
        return;
      }

      if (!root.contains(t)) {
        e.preventDefault();
        return;
      }

      if (list?.contains(t)) {
        const { scrollTop, scrollHeight, clientHeight } = list;
        const dy = e.deltaY;
        const edge = 1;
        const atTop = scrollTop <= edge;
        const atBottom = scrollTop + clientHeight >= scrollHeight - edge;
        if ((dy < 0 && atTop) || (dy > 0 && atBottom)) {
          e.preventDefault();
        }
        return;
      }

      e.preventDefault();
    };

    const onTouchMove = (e: TouchEvent) => {
      const root = rootRef.current;
      const list = listRef.current;
      const t = e.target;
      if (!(root && t instanceof Node)) {
        e.preventDefault();
        return;
      }
      if (!root.contains(t)) {
        e.preventDefault();
        return;
      }
      if (list?.contains(t)) {
        return;
      }
      e.preventDefault();
    };

    window.addEventListener("wheel", onWheel, {
      capture: true,
      passive: false,
    });
    window.addEventListener("touchmove", onTouchMove, {
      capture: true,
      passive: false,
    });
    return () => {
      window.removeEventListener("wheel", onWheel, { capture: true });
      window.removeEventListener("touchmove", onTouchMove, { capture: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
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
        const params = new URLSearchParams({ mode: "hybrid", q: query });
        if (currentSpaceId) {
          params.set("spaceId", currentSpaceId);
        }
        const res = await fetch(`/api/search/suggest?${params}`);
        const data = (await res.json()) as {
          ok?: boolean;
          suggestions?: PaletteItem[];
        };
        if (cancelled) {
          return;
        }
        if (data.ok && Array.isArray(data.suggestions)) {
          setRemote(data.suggestions);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, q, currentSpaceId]);

  const qq = q.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    if (!qq) {
      return [];
    }
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
    const result: PaletteItem[] = [];
    for (const it of filteredItems) {
      if (!seen.has(it.id)) {
        seen.add(it.id);
        result.push(it);
      }
    }
    for (const it of remote) {
      if (!seen.has(it.id)) {
        seen.add(it.id);
        result.push(it);
      }
    }
    return result;
  }, [filteredItems, remote]);

  const recentFiltered = useMemo(() => {
    if (qq) {
      return [];
    }
    return recentItems.slice(0, 8);
  }, [recentItems, qq]);

  const recentFoldersFiltered = useMemo(() => {
    const cap = 8;
    if (!qq) {
      return recentFolders.slice(0, cap);
    }
    return recentFolders
      .filter((f) =>
        `${f.title} ${f.parentSpaceName}`.toLowerCase().includes(qq)
      )
      .slice(0, cap);
  }, [recentFolders, qq]);

  const filteredSpaces = useMemo(
    () =>
      spaces
        .filter((s) => {
          if (!qq) {
            return true;
          }
          return `${s.name} ${s.pathLabel ?? ""}`.toLowerCase().includes(qq);
        })
        .slice(0, qq ? 8 : 5),
    [spaces, qq]
  );

  const filteredActions = useMemo(
    () =>
      actions
        .filter((a) => {
          if (!qq) {
            return true;
          }
          const hay = `${a.label} ${a.keywords?.join(" ") ?? ""}`.toLowerCase();
          return hay.includes(qq);
        })
        .slice(0, qq ? 12 : 14),
    [actions, qq]
  );

  const selectItem = useCallback(
    (item: PaletteItem) => {
      onRecordRecentItem({
        id: item.id,
        itemType: item.itemType,
        spaceId: item.spaceId,
        spaceName: item.spaceName,
        title: item.title,
      });
      onSelectItem(item.id, true);
      onClose();
    },
    [onClose, onRecordRecentItem, onSelectItem]
  );

  const selectSpace = useCallback(
    (spaceId: string) => {
      onSelectSpace(spaceId);
      onClose();
    },
    [onClose, onSelectSpace]
  );

  const openRecentFolder = useCallback(
    (folderId: string) => {
      onOpenRecentFolder(folderId);
      onClose();
    },
    [onClose, onOpenRecentFolder]
  );

  const runAction = useCallback(
    (actionId: string) => {
      onRunAction(actionId);
      onClose();
    },
    [onClose, onRunAction]
  );

  type PaletteRow =
    | { kind: "item"; key: string; item: PaletteItem }
    | { kind: "recentFolder"; key: string; folder: RecentPaletteFolder }
    | { kind: "space"; key: string; space: PaletteSpace }
    | { kind: "action"; key: string; action: PaletteAction };

  const flatRows = useMemo((): PaletteRow[] => {
    const rows: PaletteRow[] = [];
    for (const item of recentFiltered) {
      rows.push({ item, key: `recent-${item.id}`, kind: "item" });
    }
    for (const folder of recentFoldersFiltered) {
      rows.push({
        folder,
        key: `recent-folder-${folder.id}`,
        kind: "recentFolder",
      });
    }
    for (const item of allItems) {
      rows.push({ item, key: `item-${item.id}`, kind: "item" });
    }
    for (const space of filteredSpaces) {
      rows.push({ key: `space-${space.id}`, kind: "space", space });
    }
    for (const action of filteredActions) {
      rows.push({ action, key: `action-${action.id}`, kind: "action" });
    }
    return rows;
  }, [
    allItems,
    filteredActions,
    filteredSpaces,
    recentFiltered,
    recentFoldersFiltered,
  ]);

  const totalRows = flatRows.length;
  const hasResults = totalRows > 0;

  useEffect(() => {
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    if (!open || totalRows === 0) {
      return;
    }
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-palette-row-index="${selectedIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [open, selectedIndex, totalRows]);

  const runSelected = useCallback(() => {
    const row = flatRows[selectedIndex];
    if (!row) {
      return;
    }
    if (row.kind === "item") {
      selectItem(row.item);
    } else if (row.kind === "recentFolder") {
      openRecentFolder(row.folder.id);
    } else if (row.kind === "space") {
      selectSpace(row.space.id);
    } else {
      runAction(row.action.id);
    }
  }, [
    flatRows,
    openRecentFolder,
    runAction,
    selectItem,
    selectSpace,
    selectedIndex,
  ]);

  const onKeyDownRoot = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing || e.keyCode === 229) {
        return;
      }
      if (totalRows === 0) {
        if (e.key === "Escape") {
          e.preventDefault();
          if (q.trim()) {
            setQ("");
          } else {
            onClose();
          }
        }
        return;
      }
      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          setSelectedIndex((i) => (i + 1 >= totalRows ? 0 : i + 1));
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 < 0 ? totalRows - 1 : i - 1));
          break;
        }
        case "Home": {
          e.preventDefault();
          setSelectedIndex(0);
          break;
        }
        case "End": {
          e.preventDefault();
          setSelectedIndex(totalRows - 1);
          break;
        }
        case "Enter": {
          e.preventDefault();
          runSelected();
          break;
        }
        case "Escape": {
          e.preventDefault();
          if (q.trim()) {
            setQ("");
          } else {
            onClose();
          }
          break;
        }
        default:
          break;
      }
    },
    [onClose, q, runSelected, totalRows]
  );

  if (!open || typeof document === "undefined") {
    return null;
  }

  /* Single portal root: Fragment siblings under createPortal can trigger React removeChild(null)
   * during fast unmount (Next.js / concurrent). */
  const portal = (
    <div
      data-hg-portal-root="cmdk"
      style={{
        inset: 0,
        pointerEvents: "none",
        position: "fixed",
        zIndex: 1200,
      }}
    >
      <div
        aria-hidden="true"
        data-hg-cmdk="overlay"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        style={{ pointerEvents: "auto" }}
      />
      <div
        aria-label="Command palette"
        aria-modal="true"
        data-hg-cmdk="dialog"
        role="dialog"
      >
        <div data-hg-cmdk="root" onKeyDown={onKeyDownRoot} ref={rootRef}>
          <div data-hg-cmdk="input-wrap">
            <MagnifyingGlass
              aria-hidden
              className="size-4 shrink-0 opacity-50"
              weight="bold"
            />
            <input
              aria-activedescendant={
                totalRows > 0 ? `palette-opt-${selectedIndex}` : undefined
              }
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded
              data-hg-cmdk="input"
              id={inputId}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search items, spaces, folders, actions..."
              ref={inputRef}
              role="combobox"
              type="search"
              value={q}
            />
            <kbd className="cmdk-kbd">ESC</kbd>
          </div>

          <div
            aria-label="Suggestions"
            data-hg-cmdk="list"
            id={listboxId}
            ref={listRef}
            role="listbox"
          >
            {loading ? <div data-hg-cmdk="loading">Searching…</div> : null}

            {hasResults || loading ? null : (
              <div data-hg-cmdk="empty" role="presentation">
                No results found.
              </div>
            )}

            {recentFiltered.length > 0 ? (
              <div data-hg-cmdk="group" role="presentation">
                <div data-hg-cmdk="group-heading" id={`${listboxId}-recent`}>
                  Recent
                </div>
                <div aria-labelledby={`${listboxId}-recent`} role="group">
                  {flatRows.map((row, gi) => {
                    if (row.kind !== "item" || !row.key.startsWith("recent-")) {
                      return null;
                    }
                    const { item } = row;
                    return (
                      <Button
                        aria-selected={gi === selectedIndex}
                        data-hg-cmdk="item"
                        data-palette-row-index={gi}
                        data-selected={
                          gi === selectedIndex ? "true" : undefined
                        }
                        id={`palette-opt-${gi}`}
                        key={row.key}
                        onClick={() => selectItem(item)}
                        onMouseEnter={() => setSelectedIndex(gi)}
                        role="option"
                        tone="glass"
                        type="button"
                        variant="ghost"
                      >
                        {iconForItemType(item.itemType)}
                        <div className="cmdk-item-content">
                          <span>{item.title}</span>
                          <span className="cmdk-item-meta">
                            {item.spaceName}
                          </span>
                        </div>
                        <ClockCounterClockwise className="ml-auto size-3.5 shrink-0 opacity-40" />
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {recentFoldersFiltered.length > 0 ? (
              <div data-hg-cmdk="group" role="presentation">
                <div
                  data-hg-cmdk="group-heading"
                  id={`${listboxId}-recent-folders`}
                >
                  Recent folders
                </div>
                <div
                  aria-labelledby={`${listboxId}-recent-folders`}
                  role="group"
                >
                  {flatRows.map((row, gi) => {
                    if (row.kind !== "recentFolder") {
                      return null;
                    }
                    const { folder } = row;
                    return (
                      <Button
                        aria-selected={gi === selectedIndex}
                        data-hg-cmdk="item"
                        data-palette-row-index={gi}
                        data-selected={
                          gi === selectedIndex ? "true" : undefined
                        }
                        id={`palette-opt-${gi}`}
                        key={row.key}
                        onClick={() => openRecentFolder(folder.id)}
                        onMouseEnter={() => setSelectedIndex(gi)}
                        role="option"
                        tone="glass"
                        type="button"
                        variant="ghost"
                      >
                        <Folder className={iconCls} weight="bold" />
                        <div className="cmdk-item-content">
                          <span>{folder.title}</span>
                          <span className="cmdk-item-meta">
                            {folder.parentSpaceName || "Canvas"}
                          </span>
                        </div>
                        <ClockCounterClockwise className="ml-auto size-3.5 shrink-0 opacity-40" />
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {allItems.length > 0 ? (
              <div data-hg-cmdk="group" role="presentation">
                <div data-hg-cmdk="group-heading" id={`${listboxId}-results`}>
                  Results
                </div>
                <div aria-labelledby={`${listboxId}-results`} role="group">
                  {flatRows.map((row, gi) => {
                    if (row.kind !== "item" || !row.key.startsWith("item-")) {
                      return null;
                    }
                    const { item } = row;
                    return (
                      <Button
                        aria-selected={gi === selectedIndex}
                        data-hg-cmdk="item"
                        data-palette-row-index={gi}
                        data-selected={
                          gi === selectedIndex ? "true" : undefined
                        }
                        id={`palette-opt-${gi}`}
                        key={row.key}
                        onClick={() => selectItem(item)}
                        onMouseEnter={() => setSelectedIndex(gi)}
                        role="option"
                        tone="glass"
                        type="button"
                        variant="ghost"
                      >
                        {iconForItemType(item.itemType)}
                        <div className="cmdk-item-content">
                          <span>{item.title}</span>
                          <span className="cmdk-item-meta">
                            {item.itemType} · {item.spaceName}
                          </span>
                          {item.snippet ? (
                            <span className="cmdk-item-snippet">
                              {item.snippet}
                            </span>
                          ) : null}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {filteredSpaces.length > 0 ? (
              <div data-hg-cmdk="group" role="presentation">
                <div data-hg-cmdk="group-heading" id={`${listboxId}-spaces`}>
                  Spaces
                </div>
                <div aria-labelledby={`${listboxId}-spaces`} role="group">
                  {flatRows.map((row, gi) => {
                    if (row.kind !== "space") {
                      return null;
                    }
                    const { space } = row;
                    return (
                      <Button
                        aria-selected={gi === selectedIndex}
                        data-hg-cmdk="item"
                        data-palette-row-index={gi}
                        data-selected={
                          gi === selectedIndex ? "true" : undefined
                        }
                        id={`palette-opt-${gi}`}
                        key={row.key}
                        onClick={() => selectSpace(space.id)}
                        onMouseEnter={() => setSelectedIndex(gi)}
                        role="option"
                        tone="glass"
                        type="button"
                        variant="ghost"
                      >
                        <Folder className={iconCls} weight="bold" />
                        <div className="cmdk-item-content">
                          <span>{space.name}</span>
                          {space.pathLabel ? (
                            <span className="cmdk-item-meta">
                              {space.pathLabel}
                            </span>
                          ) : null}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {filteredActions.length > 0 ? (
              <div data-hg-cmdk="group" role="presentation">
                <div data-hg-cmdk="group-heading" id={`${listboxId}-actions`}>
                  Actions
                </div>
                <div aria-labelledby={`${listboxId}-actions`} role="group">
                  {flatRows.map((row, gi) => {
                    if (row.kind !== "action") {
                      return null;
                    }
                    const { action } = row;
                    return (
                      <Button
                        aria-selected={gi === selectedIndex}
                        data-hg-cmdk="item"
                        data-palette-row-index={gi}
                        data-selected={
                          gi === selectedIndex ? "true" : undefined
                        }
                        id={`palette-opt-${gi}`}
                        key={row.key}
                        onClick={() => runAction(action.id)}
                        onMouseEnter={() => setSelectedIndex(gi)}
                        role="option"
                        tone="glass"
                        type="button"
                        variant="ghost"
                      >
                        {action.icon ?? (
                          <PlusCircle className={iconCls} weight="bold" />
                        )}
                        <div className="cmdk-item-content">
                          <span>{action.label}</span>
                          {action.hint ? (
                            <span className="cmdk-item-meta">
                              {action.hint}
                            </span>
                          ) : null}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(portal, getVigilPortalRoot());
}
