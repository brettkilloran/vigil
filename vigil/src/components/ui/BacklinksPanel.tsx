"use client";

import { useCallback, useEffect, useState } from "react";

import { useCanvasStore } from "@/src/stores/canvas-store";

type Endpoint = { id: string; title: string; itemType: string };

type RowOut = {
  linkId: string;
  linkType: string;
  label: string | null;
  to: Endpoint;
};

type RowIn = {
  linkId: string;
  linkType: string;
  label: string | null;
  from: Endpoint;
};

type Loaded =
  | { itemId: string; outgoing: RowOut[]; incoming: RowIn[]; err: null }
  | { itemId: string; outgoing: []; incoming: []; err: string };

export function BacklinksPanel({ cloudMode }: { cloudMode: boolean }) {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const itemId = selectedIds.length === 1 ? selectedIds[0]! : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const focusItem = useCallback((id: string) => {
    const st = useCanvasStore.getState();
    const it = st.items[id];
    if (!it) return;
    const z = st.camera.zoom;
    st.setCamera({
      x: window.innerWidth / 2 - (it.x + it.width / 2) * z,
      y: window.innerHeight / 2 - (it.y + it.height / 2) * z,
      zoom: z,
    });
    st.selectOnly(id);
  }, []);

  useEffect(() => {
    if (!itemId || !cloudMode) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/items/${itemId}/links`);
      const data = (await res.json()) as {
        ok?: boolean;
        outgoing?: RowOut[];
        incoming?: RowIn[];
        error?: string;
      };
      if (cancelled) return;
      if (!data.ok) {
        setLoaded({
          itemId,
          outgoing: [],
          incoming: [],
          err: data.error ?? "Could not load links",
        });
        return;
      }
      setLoaded({
        itemId,
        outgoing: data.outgoing ?? [],
        incoming: data.incoming ?? [],
        err: null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [cloudMode, itemId]);

  if (!itemId) return null;

  const inSync = loaded?.itemId === itemId;
  const outgoing = inSync ? loaded.outgoing : [];
  const incoming = inSync ? loaded.incoming : [];
  const err = inSync ? loaded.err : null;

  if (!cloudMode) {
    return (
      <div className="pointer-events-auto absolute right-3 top-3 z-[800] max-w-[220px] rounded-lg border border-[var(--vigil-border)] bg-[var(--vigil-btn-bg)] p-2 text-xs text-[var(--vigil-muted)] shadow-md">
        Links: enable Neon to use the link graph.
      </div>
    );
  }

  const empty = outgoing.length === 0 && incoming.length === 0;

  return (
    <div className="pointer-events-auto absolute right-3 top-3 z-[800] max-h-[min(70vh,420px)] w-[min(92vw,260px)] overflow-y-auto rounded-lg border border-[var(--vigil-border)] bg-[var(--vigil-btn-bg)] p-2 text-xs shadow-md">
      <div className="mb-1 font-medium text-[var(--vigil-label)]">Links</div>
      {err ? (
        <p className="text-red-600 dark:text-red-400">{err}</p>
      ) : empty ? (
        <p className="text-[var(--vigil-muted)]">No links yet. Use POST /api/item-links.</p>
      ) : (
        <div className="space-y-2">
          {outgoing.length > 0 ? (
            <div>
              <div className="mb-0.5 text-[10px] uppercase tracking-wide text-[var(--vigil-muted)]">
                To
              </div>
              <ul className="space-y-0.5">
                {outgoing.map((r) => (
                  <li key={r.linkId}>
                    <button
                      type="button"
                      className="w-full truncate rounded px-1 py-0.5 text-left hover:bg-black/5 dark:hover:bg-white/10"
                      onClick={() => focusItem(r.to.id)}
                    >
                      {r.to.title}
                      <span className="ml-1 text-[var(--vigil-muted)]">
                        ({r.to.itemType})
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {incoming.length > 0 ? (
            <div>
              <div className="mb-0.5 text-[10px] uppercase tracking-wide text-[var(--vigil-muted)]">
                From
              </div>
              <ul className="space-y-0.5">
                {incoming.map((r) => (
                  <li key={r.linkId}>
                    <button
                      type="button"
                      className="w-full truncate rounded px-1 py-0.5 text-left hover:bg-black/5 dark:hover:bg-white/10"
                      onClick={() => focusItem(r.from.id)}
                    >
                      {r.from.title}
                      <span className="ml-1 text-[var(--vigil-muted)]">
                        ({r.from.itemType})
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
