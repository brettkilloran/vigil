"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  localIncomingToItem,
  localOutgoingFromItem,
  type LocalLinkEndpoint,
} from "@/src/lib/local-item-links";
import { VIGIL_GLASS_PANEL } from "@/src/lib/vigil-ui-classes";
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

const linkRowBtn =
  "w-full truncate rounded-lg px-1.5 py-1 text-left text-[var(--foreground)] transition-colors hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vigil-snap)]/35 dark:hover:bg-white/[0.08]";

function LinkEndpointList({
  label,
  rows,
  onPick,
}: {
  label: string;
  rows: LocalLinkEndpoint[];
  onPick: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--vigil-muted)]">
        {label}
      </div>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={r.id}>
            <button type="button" className={linkRowBtn} onClick={() => onPick(r.id)}>
              {r.title}
              <span className="ml-1 text-[var(--vigil-muted)]">({r.itemType})</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BacklinksPanel({ cloudMode }: { cloudMode: boolean }) {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const itemsRecord = useCanvasStore((s) => s.items);
  const itemId = selectedIds.length === 1 ? selectedIds[0]! : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const selectedItem = itemId ? itemsRecord[itemId] : undefined;

  const localOutgoing = useMemo(() => {
    if (!itemId || !selectedItem || cloudMode) return [];
    return localOutgoingFromItem(selectedItem, itemsRecord);
  }, [itemId, selectedItem, itemsRecord, cloudMode]);

  const localIncoming = useMemo(() => {
    if (!itemId || cloudMode) return [];
    return localIncomingToItem(itemId, itemsRecord);
  }, [itemId, itemsRecord, cloudMode]);

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

  const panelClass = `pointer-events-auto absolute right-3 top-3 z-[800] max-h-[min(70vh,440px)] w-[min(92vw,280px)] overflow-y-auto p-2.5 text-xs ${VIGIL_GLASS_PANEL}`;

  if (!cloudMode) {
    const emptyLocal =
      localOutgoing.length === 0 && localIncoming.length === 0;
    return (
      <div className={panelClass}>
        <div className="mb-1.5 font-semibold tracking-tight text-[var(--vigil-label)]">
          Links
        </div>
        <p className="mb-2 text-[10px] leading-snug text-[var(--vigil-muted)]">
          From TipTap <code className="rounded bg-black/5 px-0.5 dark:bg-white/10">[[</code>{" "}
          links on this canvas (local-only; not synced to Neon).
        </p>
        {emptyLocal ? (
          <p className="text-[var(--vigil-muted)]">
            No links in note content yet. Type{" "}
            <span className="font-medium text-[var(--foreground)]">[[</span> to link another
            card.
          </p>
        ) : (
          <div className="space-y-2.5">
            <LinkEndpointList
              label="To"
              rows={localOutgoing}
              onPick={focusItem}
            />
            <LinkEndpointList
              label="From"
              rows={localIncoming}
              onPick={focusItem}
            />
          </div>
        )}
      </div>
    );
  }

  const inSync = loaded != null && loaded.itemId === itemId;
  const outgoing = inSync ? loaded.outgoing : [];
  const incoming = inSync ? loaded.incoming : [];
  const err = inSync ? loaded.err : null;

  const empty = outgoing.length === 0 && incoming.length === 0;

  return (
    <div className={panelClass}>
      <div className="mb-1.5 font-semibold tracking-tight text-[var(--vigil-label)]">
        Links
      </div>
      <p className="mb-2 text-[10px] leading-snug text-[var(--vigil-muted)]">
        Server <code className="text-[9px]">item_links</code> plus wiki text on other notes.
      </p>
      {err ? (
        <p className="text-red-600 dark:text-red-400">{err}</p>
      ) : empty ? (
        <p className="text-[var(--vigil-muted)]">
          No links yet. Use{" "}
          <code className="rounded bg-black/5 px-0.5 text-[10px] dark:bg-white/10">
            [[
          </code>{" "}
          in notes or POST <code className="text-[9px]">/api/item-links</code>.
        </p>
      ) : (
        <div className="space-y-2.5">
          {outgoing.length > 0 ? (
            <div>
              <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--vigil-muted)]">
                To
              </div>
              <ul className="space-y-0.5">
                {outgoing.map((r) => (
                  <li key={r.linkId}>
                    <button
                      type="button"
                      className={linkRowBtn}
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
              <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--vigil-muted)]">
                From
              </div>
              <ul className="space-y-0.5">
                {incoming.map((r) => (
                  <li key={r.linkId}>
                    <button
                      type="button"
                      className={linkRowBtn}
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
