"use client";

/* eslint-disable react-hooks/set-state-in-effect -- palette open/close resets + remote search sync */
import { useCallback, useEffect, useMemo, useState } from "react";

import { useCanvasStore } from "@/src/stores/canvas-store";
import type { CanvasItem } from "@/src/stores/canvas-types";

type Hit = { kind: "item"; item: CanvasItem } | { kind: "action"; id: string; label: string };

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
  const [remote, setRemote] = useState<CanvasItem[]>([]);
  const localItems = useCanvasStore((s) => Object.values(s.items));

  const merged = useMemo(() => {
    const byId = new Map<string, CanvasItem>();
    for (const it of remote) byId.set(it.id, it);
    for (const it of localItems) byId.set(it.id, it);
    return [...byId.values()];
  }, [remote, localItems]);

  useEffect(() => {
    if (!open) {
      setQ("");
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
    if (!open || !spaceId) return;
    const query = q.trim();
    if (query.length < 2) {
      setRemote([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetch(
        `/api/search?spaceId=${encodeURIComponent(spaceId)}&q=${encodeURIComponent(query)}`,
      );
      const data = (await res.json()) as { ok?: boolean; items?: CanvasItem[] };
      if (!cancelled && data.ok && data.items) setRemote(data.items);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, q, spaceId]);

  const hits: Hit[] = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const actions: Hit[] = [
      { kind: "action", id: "export", label: "Export canvas JSON" },
      { kind: "action", id: "scratch", label: "Toggle scratch pad" },
    ];
    if (!qq) return actions;
    const items = merged
      .filter(
        (it) =>
          it.title.toLowerCase().includes(qq) ||
          it.contentText.toLowerCase().includes(qq),
      )
      .slice(0, 20)
      .map((it) => ({ kind: "item" as const, item: it }));
    return [
      ...items,
      ...actions.filter(
        (a): a is Extract<Hit, { kind: "action" }> =>
          a.kind === "action" && a.label.toLowerCase().includes(qq),
      ),
    ];
  }, [merged, q]);

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

  return (
    <div
      data-vigil-palette
      className="fixed inset-0 z-[1200] flex items-start justify-center bg-black/40 pt-[12vh] px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--vigil-border)] bg-[var(--vigil-btn-bg)] shadow-xl">
        <input
          className="w-full border-0 border-b border-[var(--vigil-border)] bg-transparent px-4 py-3 text-sm text-[var(--foreground)] outline-none"
          placeholder="Search items…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && hits[0]) run(hits[0]!);
          }}
        />
        <ul className="max-h-72 overflow-auto py-1 text-sm">
          {hits.length === 0 ? (
            <li className="px-4 py-2 text-[var(--vigil-muted)]">No results</li>
          ) : (
            hits.map((h) => (
              <li key={h.kind === "item" ? h.item.id : h.id}>
                <button
                  type="button"
                  className="flex w-full px-4 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
                  onClick={() => run(h)}
                >
                  {h.kind === "item" ? (
                    <>
                      <span className="font-medium">{h.item.title}</span>
                      <span className="ml-2 text-xs text-[var(--vigil-muted)]">
                        {h.item.itemType}
                      </span>
                    </>
                  ) : (
                    h.label
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
