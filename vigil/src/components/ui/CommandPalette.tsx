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
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import type { RecentPaletteItem } from "@/src/hooks/use-recent-items";
import { Button } from "@/src/components/ui/Button";

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
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  /** Stop page/canvas from scrolling while the palette is open. */
  useEffect(() => {
    if (!open) return;
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
    if (!open) return;

    const onWheel = (e: WheelEvent) => {
      const root = rootRef.current;
      const list = listRef.current;
      const t = e.target;
      if (!root || !(t instanceof Node)) return;

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
      if (!root || !(t instanceof Node)) {
        e.preventDefault();
        return;
      }
      if (!root.contains(t)) {
        e.preventDefault();
        return;
      }
      if (list?.contains(t)) return;
      e.preventDefault();
    };

    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    window.addEventListener("touchmove", onTouchMove, {
      passive: false,
      capture: true,
    });
    return () => {
      window.removeEventListener("wheel", onWheel, { capture: true });
      window.removeEventListener("touchmove", onTouchMove, { capture: true });
    };
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

  type PaletteRow =
    | { kind: "item"; key: string; item: PaletteItem }
    | { kind: "space"; key: string; space: PaletteSpace }
    | { kind: "action"; key: string; action: PaletteAction };

  const flatRows = useMemo((): PaletteRow[] => {
    const rows: PaletteRow[] = [];
    for (const item of recentFiltered) {
      rows.push({ kind: "item", key: `recent-${item.id}`, item });
    }
    for (const item of allItems) {
      rows.push({ kind: "item", key: `item-${item.id}`, item });
    }
    for (const space of filteredSpaces) {
      rows.push({ kind: "space", key: `space-${space.id}`, space });
    }
    for (const action of filteredActions) {
      rows.push({ kind: "action", key: `action-${action.id}`, action });
    }
    return rows;
  }, [allItems, filteredActions, filteredSpaces, recentFiltered]);

  const totalRows = flatRows.length;
  const hasResults = totalRows > 0;

  useEffect(() => {
    setSelectedIndex(0);
  }, [qq, totalRows, open]);

  useEffect(() => {
    if (!open || totalRows === 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-palette-row-index="${selectedIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [open, selectedIndex, totalRows]);

  const runSelected = useCallback(() => {
    const row = flatRows[selectedIndex];
    if (!row) return;
    if (row.kind === "item") selectItem(row.item);
    else if (row.kind === "space") selectSpace(row.space.id);
    else runAction(row.action.id);
  }, [flatRows, runAction, selectItem, selectSpace, selectedIndex]);

  const onKeyDownRoot = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      if (totalRows === 0) {
        if (e.key === "Escape") {
          e.preventDefault();
          if (q.trim()) setQ("");
          else onClose();
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
          if (q.trim()) setQ("");
          else onClose();
          break;
        }
        default:
          break;
      }
    },
    [onClose, q, runSelected, totalRows],
  );

  if (!open || typeof document === "undefined") return null;

  const portal = (
    <>
      <div
        data-hg-cmdk="overlay"
        aria-hidden="true"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      />
      <div
        data-hg-cmdk="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div ref={rootRef} data-hg-cmdk="root" onKeyDown={onKeyDownRoot}>
          <div data-hg-cmdk="input-wrap">
            <MagnifyingGlass
              className="size-4 shrink-0 opacity-50"
              weight="bold"
              aria-hidden
            />
            <input
              ref={inputRef}
              id={inputId}
              data-hg-cmdk="input"
              type="search"
              role="combobox"
              aria-expanded
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={
                totalRows > 0 ? `palette-opt-${selectedIndex}` : undefined
              }
              placeholder="Search items, spaces, actions..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <kbd className="cmdk-kbd">ESC</kbd>
          </div>

          <div
            ref={listRef}
            id={listboxId}
            data-hg-cmdk="list"
            role="listbox"
            aria-label="Suggestions"
          >
            {loading ? (
              <div data-hg-cmdk="loading">Searching…</div>
            ) : null}

            {!hasResults && !loading ? (
              <div data-hg-cmdk="empty" role="presentation">
                No results found.
              </div>
            ) : null}

            {recentFiltered.length > 0 ? (
              <div data-hg-cmdk="group" role="presentation">
                <div data-hg-cmdk="group-heading" id={`${listboxId}-recent`}>
                  Recent
                </div>
                <div role="group" aria-labelledby={`${listboxId}-recent`}>
                  {flatRows.map((row, gi) => {
                    if (row.kind !== "item" || !row.key.startsWith("recent-"))
                      return null;
                    const { item } = row;
                    return (
                      <Button
                        key={row.key}
                        type="button"
                        variant="ghost"
                        tone="glass"
                        id={`palette-opt-${gi}`}
                        data-hg-cmdk="item"
                        data-palette-row-index={gi}
                        role="option"
                        aria-selected={gi === selectedIndex}
                        data-selected={gi === selectedIndex ? "true" : undefined}
                        onMouseEnter={() => setSelectedIndex(gi)}
                        onClick={() => selectItem(item)}
                      >
                        {iconForItemType(item.itemType)}
                        <div className="cmdk-item-content">
                          <span>{item.title}</span>
                          <span className="cmdk-item-meta">{item.spaceName}</span>
                        </div>
                        <ClockCounterClockwise className="size-3.5 opacity-40 ml-auto shrink-0" />
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
                <div role="group" aria-labelledby={`${listboxId}-results`}>
                  {flatRows.map((row, gi) => {
                    if (row.kind !== "item" || !row.key.startsWith("item-"))
                      return null;
                    const { item } = row;
                    return (
                      <Button
                        key={row.key}
                        type="button"
                        variant="ghost"
                        tone="glass"
                        id={`palette-opt-${gi}`}
                        data-hg-cmdk="item"
                        data-palette-row-index={gi}
                        role="option"
                        aria-selected={gi === selectedIndex}
                        data-selected={gi === selectedIndex ? "true" : undefined}
                        onMouseEnter={() => setSelectedIndex(gi)}
                        onClick={() => selectItem(item)}
                      >
                        {iconForItemType(item.itemType)}
                        <div className="cmdk-item-content">
                          <span>{item.title}</span>
                          <span className="cmdk-item-meta">
                            {item.itemType} · {item.spaceName}
                          </span>
                          {item.snippet ? (
                            <span className="cmdk-item-snippet">{item.snippet}</span>
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
                <div role="group" aria-labelledby={`${listboxId}-spaces`}>
                  {flatRows.map((row, gi) => {
                    if (row.kind !== "space") return null;
                    const { space } = row;
                    return (
                      <Button
                        key={row.key}
                        type="button"
                        variant="ghost"
                        tone="glass"
                        id={`palette-opt-${gi}`}
                        data-hg-cmdk="item"
                        data-palette-row-index={gi}
                        role="option"
                        aria-selected={gi === selectedIndex}
                        data-selected={gi === selectedIndex ? "true" : undefined}
                        onMouseEnter={() => setSelectedIndex(gi)}
                        onClick={() => selectSpace(space.id)}
                      >
                        <Folder className={iconCls} weight="bold" />
                        <div className="cmdk-item-content">
                          <span>{space.name}</span>
                          {space.pathLabel ? (
                            <span className="cmdk-item-meta">{space.pathLabel}</span>
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
                <div role="group" aria-labelledby={`${listboxId}-actions`}>
                  {flatRows.map((row, gi) => {
                    if (row.kind !== "action") return null;
                    const { action } = row;
                    return (
                      <Button
                        key={row.key}
                        type="button"
                        variant="ghost"
                        tone="glass"
                        id={`palette-opt-${gi}`}
                        data-hg-cmdk="item"
                        data-palette-row-index={gi}
                        role="option"
                        aria-selected={gi === selectedIndex}
                        data-selected={gi === selectedIndex ? "true" : undefined}
                        onMouseEnter={() => setSelectedIndex(gi)}
                        onClick={() => runAction(action.id)}
                      >
                        {action.icon ?? (
                          <PlusCircle className={iconCls} weight="bold" />
                        )}
                        <div className="cmdk-item-content">
                          <span>{action.label}</span>
                          {action.hint ? (
                            <span className="cmdk-item-meta">{action.hint}</span>
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
    </>
  );

  return createPortal(portal, document.body);
}
