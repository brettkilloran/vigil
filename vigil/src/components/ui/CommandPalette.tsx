"use client";

import {
  ClockCounterClockwise,
  Command,
  DownloadSimple,
  FileText,
  Folder,
  Globe,
  ImageSquare,
  ListChecks,
  MagnifyingGlass,
  Notebook,
  NotePencil,
  PlusCircle,
  Rows,
  Sparkle,
  Stack,
  TextT,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, type ReactNode, useState } from "react";

import { Button } from "@/src/components/ui/Button";
import type { RecentPaletteItem } from "@/src/hooks/use-recent-items";
import { useModKeyHints } from "@/src/lib/mod-keys";
import { HEARTGARDEN_GLASS_PANEL } from "@/src/lib/vigil-ui-classes";

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

type Hit =
  | { kind: "item"; item: PaletteItem; source: "local" | "remote" | "recent" }
  | { kind: "space"; space: PaletteSpace }
  | { kind: "action"; action: PaletteAction };

const hitIconClass =
  "size-4 shrink-0 text-[var(--vigil-muted)] opacity-90";

function iconForItemType(itemType: string): ReactNode {
  switch (itemType) {
    case "note":
      return <FileText className={hitIconClass} weight="bold" aria-hidden />;
    case "sticky":
      return <NotePencil className={hitIconClass} weight="bold" aria-hidden />;
    case "image":
      return <ImageSquare className={hitIconClass} weight="bold" aria-hidden />;
    case "checklist":
      return <ListChecks className={hitIconClass} weight="bold" aria-hidden />;
    case "webclip":
      return <Globe className={hitIconClass} weight="bold" aria-hidden />;
    case "folder":
      return <Folder className={hitIconClass} weight="bold" aria-hidden />;
    default:
      return <FileText className={hitIconClass} weight="bold" aria-hidden />;
  }
}

type SearchMode = "fts" | "semantic" | "hybrid";
type Scope = "current" | "all";
type TimeFilter = "any" | "today" | "week" | "month";

const LS_CMDK_SEARCH_MODE = "vigil-cmdk-search-mode";
const LS_CMDK_SCOPE = "vigil-cmdk-scope";

function readStoredSearchMode(): SearchMode {
  if (typeof window === "undefined") return "hybrid";
  try {
    const v = localStorage.getItem(LS_CMDK_SEARCH_MODE);
    if (v === "fts" || v === "semantic" || v === "hybrid") return v;
  } catch {
    /* ignore */
  }
  return "hybrid";
}

function readStoredScope(): Scope {
  if (typeof window === "undefined") return "current";
  try {
    const v = localStorage.getItem(LS_CMDK_SCOPE);
    if (v === "current" || v === "all") return v;
  } catch {
    /* ignore */
  }
  return "current";
}

const ITEM_TYPE_OPTIONS = [
  "note",
  "sticky",
  "image",
  "checklist",
  "webclip",
  "folder",
] as const;
const ENTITY_TYPE_OPTIONS = [
  "character",
  "location",
  "faction",
  "event",
  "item",
  "lore",
] as const;

function highlightMatch(text: string, query: string): ReactNode {
  const qq = query.trim();
  if (!qq) return text;
  const idx = text.toLowerCase().indexOf(qq.toLowerCase());
  if (idx < 0) return text;
  const end = idx + qq.length;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-[var(--sem-surface-muted-hover)] px-0.5 text-[var(--foreground)]">
        {text.slice(idx, end)}
      </mark>
      {text.slice(end)}
    </>
  );
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
  const [searchMode, setSearchMode] = useState<SearchMode>("hybrid");
  const [scope, setScope] = useState<Scope>("current");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("any");
  const [itemTypes, setItemTypes] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [hasLinksOnly, setHasLinksOnly] = useState(false);
  const [inStackOnly, setInStackOnly] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSearchMode(readStoredSearchMode());
    setScope(readStoredScope());
  }, []);

  const setSearchModePersist = useCallback((m: SearchMode) => {
    setSearchMode(m);
    try {
      localStorage.setItem(LS_CMDK_SEARCH_MODE, m);
    } catch {
      /* ignore */
    }
  }, []);
  const setScopePersist = useCallback((next: Scope) => {
    setScope(next);
    try {
      localStorage.setItem(LS_CMDK_SCOPE, next);
    } catch {
      /* ignore */
    }
  }, []);
  const [remote, setRemote] = useState<PaletteItem[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteHint, setRemoteHint] = useState<string | null>(null);
  const modKeys = useModKeyHints();

  useEffect(() => {
    if (!open) {
      setQ("");
      setRemote([]);
      setRemoteHint(null);
      setRemoteLoading(false);
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    if (!open) {
      setRemote([]);
      setRemoteHint(null);
      setRemoteLoading(false);
      return () => {
        cancelled = true;
      };
    }
    const query = q.trim();
    if (query.length < 2) {
      setRemote([]);
      setRemoteHint(null);
      setRemoteLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setRemoteLoading(true);
    setRemoteHint(null);
    const debounce = setTimeout(async () => {
      const params = new URLSearchParams();
      params.set("q", query);
      params.set("mode", searchMode);
      if (scope === "current" && currentSpaceId) {
        params.set("spaceId", currentSpaceId);
      }
      if (itemTypes.length > 0) params.set("types", itemTypes.join(","));
      if (entityTypes.length > 0) params.set("entityTypes", entityTypes.join(","));
      if (hasLinksOnly) params.set("hasLinks", "true");
      if (inStackOnly) params.set("inStack", "true");
      if (timeFilter !== "any") {
        const now = new Date();
        const ms =
          timeFilter === "today"
            ? 24 * 60 * 60 * 1000
            : timeFilter === "week"
              ? 7 * 24 * 60 * 60 * 1000
              : 30 * 24 * 60 * 60 * 1000;
        params.set("updatedAfter", new Date(now.getTime() - ms).toISOString());
      }
      void (async () => {
        try {
          const res = await fetch(`/api/search/suggest?${params.toString()}`);
          const data = (await res.json()) as {
            ok?: boolean;
            suggestions?: PaletteItem[];
            error?: string;
          };
          if (cancelled) return;
          if (data.ok && Array.isArray(data.suggestions)) {
            setRemote(data.suggestions);
            setRemoteHint(null);
          } else {
            setRemote([]);
            setRemoteHint(data.error ?? `Search failed (${res.status})`);
          }
        } finally {
          if (!cancelled) setRemoteLoading(false);
        }
      })();
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [open, q, currentSpaceId, scope, itemTypes, entityTypes, hasLinksOnly, inStackOnly, timeFilter, searchMode]);

  const filteredLocalItems = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const filtered = items.filter((it) => {
      if (scope === "current" && currentSpaceId && it.spaceId !== currentSpaceId) return false;
      if (itemTypes.length > 0 && !itemTypes.includes(it.itemType)) return false;
      if (entityTypes.length > 0 && (!it.entityType || !entityTypes.includes(it.entityType))) return false;
      if (timeFilter !== "any" && it.updatedAt) {
        const t = new Date(it.updatedAt).getTime();
        const cutoff =
          Date.now() -
          (timeFilter === "today"
            ? 24 * 60 * 60 * 1000
            : timeFilter === "week"
              ? 7 * 24 * 60 * 60 * 1000
              : 30 * 24 * 60 * 60 * 1000);
        if (Number.isFinite(t) && t < cutoff) return false;
      }
      if (!qq) return true;
      const hay = `${it.title} ${it.snippet ?? ""} ${it.spaceName}`.toLowerCase();
      return hay.includes(qq);
    });
    return filtered.slice(0, 20);
  }, [items, q, scope, currentSpaceId, itemTypes, entityTypes, timeFilter]);

  const hits: Hit[] = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const out: Hit[] = [];
    const dedup = new Set<string>();

    if (!qq) {
      for (const recent of recentItems.slice(0, 8)) {
        out.push({ kind: "item", source: "recent", item: recent });
        dedup.add(recent.id);
      }
    }

    for (const it of filteredLocalItems) {
      if (dedup.has(it.id)) continue;
      out.push({ kind: "item", source: "local", item: it });
      dedup.add(it.id);
    }
    for (const it of remote) {
      if (dedup.has(it.id)) continue;
      out.push({ kind: "item", source: "remote", item: it });
      dedup.add(it.id);
    }

    const filteredSpaces = spaces.filter((space) => {
      if (!qq) return true;
      return `${space.name} ${space.pathLabel ?? ""}`.toLowerCase().includes(qq);
    });
    for (const space of filteredSpaces.slice(0, qq ? 8 : 5)) {
      out.push({ kind: "space", space });
    }

    const filteredActions = actions.filter((action) => {
      if (!qq) return true;
      const hay = `${action.label} ${action.keywords?.join(" ") ?? ""}`.toLowerCase();
      return hay.includes(qq);
    });
    for (const action of filteredActions.slice(0, qq ? 8 : 6)) {
      out.push({ kind: "action", action });
    }

    return out.slice(0, 60);
  }, [actions, filteredLocalItems, q, recentItems, remote, spaces]);

  const run = useCallback(
    (h: Hit) => {
      if (h.kind === "item") {
        onRecordRecentItem({
          id: h.item.id,
          title: h.item.title,
          itemType: h.item.itemType,
          spaceId: h.item.spaceId,
          spaceName: h.item.spaceName,
        });
        onSelectItem(h.item.id);
        onClose();
        return;
      }
      if (h.kind === "space") {
        onSelectSpace(h.space.id);
        onClose();
        return;
      }
      onRunAction(h.action.id);
      onClose();
    },
    [onClose, onRecordRecentItem, onRunAction, onSelectItem, onSelectSpace],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [q, scope, searchMode, itemTypes, entityTypes, hasLinksOnly, inStackOnly, timeFilter, hits.length]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, hits.length - 1)));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (event.key === "Enter") {
        if (hits[selectedIndex]) {
          event.preventDefault();
          run(hits[selectedIndex]!);
        }
      } else if (event.key === "Escape") {
        if (q.trim().length > 0) {
          event.preventDefault();
          setQ("");
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hits, onClose, open, q, run, selectedIndex]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const child = list.children.item(selectedIndex) as HTMLElement | null;
    child?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  const modeButtons: {
    id: SearchMode;
    label: string;
    title: string;
    icon: ReactNode;
  }[] = [
    {
      id: "fts",
      label: "Keywords",
      title: "Full-text search (Postgres)",
      icon: <TextT className="size-3.5 shrink-0 opacity-90" weight="bold" aria-hidden />,
    },
    {
      id: "semantic",
      label: "Meaning",
      title:
        "Vector similarity (embeddings refresh when items are saved; needs OPENAI_API_KEY)",
      icon: <Sparkle className="size-3.5 shrink-0 opacity-90" weight="bold" aria-hidden />,
    },
    {
      id: "hybrid",
      label: "Both",
      title: "Keywords first, then extra semantic matches",
      icon: <Stack className="size-3.5 shrink-0 opacity-90" weight="bold" aria-hidden />,
    },
  ];
  const scopeButtons: { id: Scope; label: string }[] = [
    { id: "current", label: "Current space" },
    { id: "all", label: "All spaces" },
  ];
  const timeButtons: { id: TimeFilter; label: string }[] = [
    { id: "any", label: "Any time" },
    { id: "today", label: "Today" },
    { id: "week", label: "This week" },
    { id: "month", label: "This month" },
  ];

  const toggleString = (value: string, list: string[], setList: (next: string[]) => void) => {
    if (list.includes(value)) setList(list.filter((v) => v !== value));
    else setList([...list, value]);
  };

  return (
    <AnimatePresence>
      <motion.div
        data-vigil-palette
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[1200] flex items-start justify-center bg-black/35 px-4 pt-[8vh] backdrop-blur-[2px] dark:bg-black/55"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className={`${HEARTGARDEN_GLASS_PANEL} w-full max-w-4xl overflow-hidden`}
        >
          <div className="flex items-center gap-2.5 border-b border-[var(--sem-border-subtle)] px-4 py-3">
            <MagnifyingGlass className="size-4 shrink-0 text-[var(--vigil-muted)] opacity-90" weight="bold" />
            <input
              ref={inputRef}
              className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--vigil-muted)] focus-visible:ring-0"
              placeholder={`Search items, spaces, actions (${modKeys.search})`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search"
            />
            <span className="inline-flex items-center gap-1 rounded border border-[var(--sem-border-soft)] px-1.5 py-0.5 text-[11px] text-[var(--vigil-muted)]">
              <Command className="size-3" weight="bold" />
              ESC
            </span>
          </div>

          <div className="flex gap-2 border-b border-[var(--sem-border-subtle)] px-3 py-2">
            {scopeButtons.map((b) => (
              <Button
                key={b.id}
                size="xs"
                variant={scope === b.id ? "primary" : "subtle"}
                tone={scope === b.id ? "solid" : "menu"}
                onClick={() => setScopePersist(b.id)}
              >
                {b.label}
              </Button>
            ))}
            <div className="mx-1 h-6 w-px bg-[var(--sem-border-soft)]" />
            {modeButtons.map((b) => (
              <Button
                key={b.id}
                size="xs"
                variant={searchMode === b.id ? "primary" : "subtle"}
                tone={searchMode === b.id ? "solid" : "menu"}
                title={b.title}
                onClick={() => setSearchModePersist(b.id)}
              >
                {b.icon}
                {b.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-[var(--sem-border-subtle)] px-3 py-2">
            {ITEM_TYPE_OPTIONS.map((type) => (
              <Button
                key={type}
                size="xs"
                variant={itemTypes.includes(type) ? "primary" : "subtle"}
                tone={itemTypes.includes(type) ? "solid" : "menu"}
                onClick={() => toggleString(type, itemTypes, setItemTypes)}
              >
                {type}
              </Button>
            ))}
            <div className="mx-1 h-6 w-px bg-[var(--sem-border-soft)]" />
            {ENTITY_TYPE_OPTIONS.map((type) => (
              <Button
                key={type}
                size="xs"
                variant={entityTypes.includes(type) ? "primary" : "subtle"}
                tone={entityTypes.includes(type) ? "solid" : "menu"}
                onClick={() => toggleString(type, entityTypes, setEntityTypes)}
              >
                {type}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-[var(--sem-border-subtle)] px-3 py-2">
            {timeButtons.map((b) => (
              <Button
                key={b.id}
                size="xs"
                variant={timeFilter === b.id ? "primary" : "subtle"}
                tone={timeFilter === b.id ? "solid" : "menu"}
                onClick={() => setTimeFilter(b.id)}
              >
                {b.label}
              </Button>
            ))}
            <div className="mx-1 h-6 w-px bg-[var(--sem-border-soft)]" />
            <Button
              size="xs"
              variant={hasLinksOnly ? "primary" : "subtle"}
              tone={hasLinksOnly ? "solid" : "menu"}
              onClick={() => setHasLinksOnly((prev) => !prev)}
            >
              Has links
            </Button>
            <Button
              size="xs"
              variant={inStackOnly ? "primary" : "subtle"}
              tone={inStackOnly ? "solid" : "menu"}
              onClick={() => setInStackOnly((prev) => !prev)}
            >
              In stack
            </Button>
          </div>

          {remoteHint ? (
            <p className="border-b border-[var(--sem-border-subtle)] px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
              {remoteHint}
            </p>
          ) : null}

          <ul ref={listRef} className="max-h-[min(60vh,480px)] overflow-auto py-1.5 text-sm">
            {remoteLoading && q.trim().length >= 2 ? (
              <li className="px-4 py-2.5 text-[var(--vigil-muted)]">Searching...</li>
            ) : null}
            {hits.length === 0 ? (
              <li className="px-4 py-2.5 text-[var(--vigil-muted)]">No results</li>
            ) : (
              hits.map((h, index) => (
                <li key={h.kind === "item" ? `${h.source}:${h.item.id}` : h.kind === "space" ? `space:${h.space.id}` : `action:${h.action.id}`}>
                  <Button
                    size="sm"
                    variant="subtle"
                    tone="menu"
                    className={`flex w-full items-start justify-start gap-2.5 px-4 py-2.5 ${index === selectedIndex ? "bg-[var(--sem-surface-muted-hover)]" : ""}`}
                    onClick={() => run(h)}
                  >
                    {h.kind === "item" ? (
                      <>
                        {iconForItemType(h.item.itemType)}
                        <span className="min-w-0 flex-1 text-left">
                          <span className="font-medium text-[var(--foreground)]">
                            {highlightMatch(h.item.title, q)}
                          </span>
                          <span className="ml-2 text-xs text-[var(--vigil-muted)]">{h.item.itemType}</span>
                          <span className="ml-2 text-xs text-[var(--vigil-muted)]">{h.item.spaceName}</span>
                          {h.item.snippet ? (
                            <span className="mt-0.5 block text-xs text-[var(--vigil-muted)]">
                              {highlightMatch(h.item.snippet, q)}
                            </span>
                          ) : null}
                        </span>
                        {h.source === "recent" ? (
                          <ClockCounterClockwise className="size-3.5 text-[var(--vigil-muted)]" />
                        ) : h.source === "remote" ? (
                          <Rows className="size-3.5 text-[var(--vigil-muted)]" />
                        ) : null}
                      </>
                    ) : h.kind === "space" ? (
                      <>
                        <Folder className={hitIconClass} weight="bold" aria-hidden />
                        <span className="min-w-0 flex-1 text-left font-medium text-[var(--foreground)]">
                          {highlightMatch(h.space.name, q)}
                          {h.space.pathLabel ? (
                            <span className="mt-0.5 block text-xs text-[var(--vigil-muted)]">{h.space.pathLabel}</span>
                          ) : null}
                        </span>
                      </>
                    ) : (
                      <>
                        {h.action.icon ?? <PlusCircle className={hitIconClass} weight="bold" aria-hidden />}
                        <span className="min-w-0 flex-1 text-left font-medium text-[var(--foreground)]">
                          {highlightMatch(h.action.label, q)}
                          {h.action.hint ? (
                            <span className="mt-0.5 block text-xs text-[var(--vigil-muted)]">{h.action.hint}</span>
                          ) : null}
                        </span>
                      </>
                    )}
                  </Button>
                </li>
              ))
            )}
          </ul>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
