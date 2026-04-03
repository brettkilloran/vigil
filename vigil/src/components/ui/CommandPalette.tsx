"use client";

import {
  DownloadSimple,
  FileText,
  Folder,
  Globe,
  ImageSquare,
  ListChecks,
  MagnifyingGlass,
  Notebook,
  NotePencil,
  Sparkle,
  Stack,
  TextT,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, type ReactNode, useState } from "react";

import { useModKeyHints } from "@/src/lib/mod-keys";
import { useCanvasStore } from "@/src/stores/canvas-store";
import type { CanvasItem } from "@/src/stores/canvas-types";

type Hit =
  | { kind: "item"; item: CanvasItem }
  | { kind: "action"; id: string; label: string; icon: ReactNode };

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

const LS_CMDK_SEARCH_MODE = "vigil-cmdk-search-mode";

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

export function CommandPalette({
  open,
  onClose,
  spaceId,
  onSelectItem,
  onExportJson,
}: {
  open: boolean;
  onClose: () => void;
  spaceId: string | null;
  onSelectItem: (id: string) => void;
  onExportJson: () => void;
}) {
  const [q, setQ] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("hybrid");

  useEffect(() => {
    setSearchMode(readStoredSearchMode());
  }, []);

  const setSearchModePersist = useCallback((m: SearchMode) => {
    setSearchMode(m);
    try {
      localStorage.setItem(LS_CMDK_SEARCH_MODE, m);
    } catch {
      /* ignore */
    }
  }, []);
  const [remote, setRemote] = useState<CanvasItem[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteHint, setRemoteHint] = useState<string | null>(null);
  const modKeys = useModKeyHints();

  const itemsRecord = useCanvasStore((s) => s.items);
  const localItems = useMemo(
    () => Object.values(itemsRecord),
    [itemsRecord],
  );

  useEffect(() => {
    if (!open) {
      setQ("");
      setRemote([]);
      setRemoteHint(null);
      setRemoteLoading(false);
      return;
    }
    const t = setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(
        "[data-vigil-palette] input",
      );
      input?.focus();
    }, 10);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    if (!open || !spaceId) {
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
    const debounce = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/search?spaceId=${encodeURIComponent(spaceId)}&q=${encodeURIComponent(query)}&mode=${encodeURIComponent(searchMode)}`,
          );
          const data = (await res.json()) as {
            ok?: boolean;
            items?: CanvasItem[];
            error?: string;
          };
          if (cancelled) return;
          if (data.ok && Array.isArray(data.items)) {
            setRemote(data.items);
            setRemoteHint(null);
          } else {
            setRemote([]);
            setRemoteHint(data.error ?? `Search failed (${res.status})`);
          }
        } finally {
          if (!cancelled) setRemoteLoading(false);
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [open, q, spaceId, searchMode]);

  const hits: Hit[] = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const actions: Hit[] = [
      {
        kind: "action",
        id: "export",
        label: "Export canvas",
        icon: <DownloadSimple className={hitIconClass} weight="bold" aria-hidden />,
      },
      {
        kind: "action",
        id: "scratch",
        label: "Scratch pad",
        icon: <Notebook className={hitIconClass} weight="bold" aria-hidden />,
      },
    ];

    if (!qq) return actions;

    const byId = new Map<string, CanvasItem>();
    for (const it of remote) byId.set(it.id, it);
    for (const it of localItems) byId.set(it.id, it);

    let itemHits: CanvasItem[];

    if (spaceId && qq.length >= 2) {
      itemHits = remote.map((r) => byId.get(r.id) ?? r);
    } else {
      itemHits = localItems
        .filter(
          (it) =>
            it.title.toLowerCase().includes(qq) ||
            it.contentText.toLowerCase().includes(qq),
        )
        .slice(0, 20);
    }

    const itemRows: Hit[] = itemHits.map((it) => ({
      kind: "item" as const,
      item: it,
    }));

    return [
      ...itemRows,
      ...actions.filter(
        (a): a is Extract<Hit, { kind: "action" }> =>
          a.kind === "action" && a.label.toLowerCase().includes(qq),
      ),
    ];
  }, [remote, localItems, spaceId, q]);

  const run = useCallback(
    (h: Hit) => {
      if (h.kind === "item") {
        onSelectItem(h.item.id);
        onClose();
        return;
      }
      if (h.id === "export") {
        onExportJson();
        onClose();
        return;
      }
      if (h.id === "scratch") {
        useCanvasStore.getState().setScratchPadOpen(true);
        onClose();
      }
    },
    [onClose, onExportJson, onSelectItem],
  );

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

  return (
    <div
      data-vigil-palette
      className="fixed inset-0 z-[1200] flex items-start justify-center bg-black/35 px-4 pt-[12vh] backdrop-blur-[2px] dark:bg-black/55"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--vigil-border)] bg-[var(--vigil-elevated)]/95 shadow-2xl shadow-black/15 backdrop-blur-xl dark:bg-[var(--vigil-elevated)]/90 dark:shadow-black/50">
        <div className="flex items-center gap-2.5 border-b border-[var(--vigil-border)] px-3 py-2.5">
          <MagnifyingGlass
            className="size-4 shrink-0 text-[var(--vigil-muted)] opacity-90"
            weight="bold"
            aria-hidden
          />
          <input
            className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--vigil-muted)] focus-visible:ring-0"
            placeholder={
              spaceId
                ? `Search items (${modKeys.search})…`
                : `Search local canvas (${modKeys.search} opens this)…`
            }
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && hits[0]) run(hits[0]!);
            }}
            aria-label="Search"
          />
        </div>
        {spaceId ? (
          <div className="flex flex-wrap gap-1.5 border-b border-[var(--vigil-border)] px-3 py-2.5">
            {modeButtons.map((b) => (
              <button
                key={b.id}
                type="button"
                title={b.title}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vigil-snap)]/35 ${
                  searchMode === b.id
                    ? "bg-[var(--vigil-label)] text-[var(--vigil-btn-bg)]"
                    : "text-[var(--vigil-muted)] hover:bg-black/5 dark:hover:bg-white/10"
                }`}
                onClick={() => setSearchModePersist(b.id)}
              >
                {b.icon}
                {b.label}
              </button>
            ))}
          </div>
        ) : null}
        {remoteHint ? (
          <p className="border-b border-[var(--vigil-border)] px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
            {remoteHint}
          </p>
        ) : null}
        <ul className="max-h-72 overflow-auto py-1.5 text-sm">
          {remoteLoading && spaceId && q.trim().length >= 2 ? (
            <li className="px-4 py-2.5 text-[var(--vigil-muted)]">Searching…</li>
          ) : null}
          {!remoteLoading || !spaceId || q.trim().length < 2 ? (
            hits.length === 0 ? (
              <li className="px-4 py-2.5 text-[var(--vigil-muted)]">
                {spaceId &&
                q.trim().length >= 2 &&
                (searchMode === "semantic" || searchMode === "hybrid")
                  ? "No matches. For Meaning/Both, set OPENAI_API_KEY and save items (or POST /api/items/[id]/embed)."
                  : "No results"}
              </li>
            ) : (
              hits.map((h) => (
                <li key={h.kind === "item" ? h.item.id : h.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-black/5 focus-visible:bg-black/5 focus-visible:outline-none dark:hover:bg-white/10 dark:focus-visible:bg-white/10"
                    onClick={() => run(h)}
                  >
                    {h.kind === "item" ? (
                      <>
                        {iconForItemType(h.item.itemType)}
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-[var(--foreground)]">
                            {h.item.title}
                          </span>
                          <span className="ml-2 text-xs text-[var(--vigil-muted)]">
                            {h.item.itemType}
                          </span>
                        </span>
                      </>
                    ) : (
                      <>
                        {h.icon}
                        <span className="font-medium text-[var(--foreground)]">
                          {h.label}
                        </span>
                      </>
                    )}
                  </button>
                </li>
              ))
            )
          ) : null}
        </ul>
      </div>
    </div>
  );
}
