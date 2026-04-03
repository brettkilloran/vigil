"use client";

import { LinkSimple } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  localIncomingToItem,
  localOutgoingFromItem,
  type LocalLinkEndpoint,
} from "@/src/lib/local-item-links";
import { localItemsMentioningTitle } from "@/src/lib/local-title-mentions";
import {
  VIGIL_GLASS_PANEL,
  VIGIL_METADATA_LABEL,
} from "@/src/lib/vigil-ui-classes";
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

type LinkRow = Pick<Endpoint, "id" | "title" | "itemType">;

const linkRowBtn =
  "w-full truncate rounded-lg px-2 py-1.5 text-left text-[var(--foreground)] transition-colors hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vigil-snap)]/35 dark:hover:bg-white/[0.08]";

function LinkRowList({
  label,
  rows,
  onPick,
}: {
  label: string;
  rows: LinkRow[];
  onPick: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className={`mb-1 ${VIGIL_METADATA_LABEL}`}>{label}</div>
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

function WikiLinkSection({
  localOutgoing,
  localIncoming,
  focusItem,
}: {
  localOutgoing: LocalLinkEndpoint[];
  localIncoming: LocalLinkEndpoint[];
  focusItem: (id: string) => void;
}) {
  const emptyWiki = localOutgoing.length === 0 && localIncoming.length === 0;
  return (
    <>
      {emptyWiki ? (
        <p className="text-[var(--vigil-muted)]">
          No <code className="rounded bg-black/5 px-0.5 dark:bg-white/10">[[</code>{" "}
          links in note content yet.
        </p>
      ) : (
        <div className="space-y-2.5">
          <LinkRowList label="To" rows={localOutgoing} onPick={focusItem} />
          <LinkRowList label="From" rows={localIncoming} onPick={focusItem} />
        </div>
      )}
    </>
  );
}

export function BacklinksPanel({ cloudMode }: { cloudMode: boolean }) {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const itemsRecord = useCanvasStore((s) => s.items);
  const itemId = selectedIds.length === 1 ? selectedIds[0]! : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);

  const selectedItem = itemId ? itemsRecord[itemId] : undefined;

  const localOutgoing = useMemo(() => {
    if (!itemId || !selectedItem || cloudMode) return [];
    return localOutgoingFromItem(selectedItem, itemsRecord);
  }, [itemId, selectedItem, itemsRecord, cloudMode]);

  const localIncoming = useMemo(() => {
    if (!itemId || cloudMode) return [];
    return localIncomingToItem(itemId, itemsRecord);
  }, [itemId, itemsRecord, cloudMode]);

  const titleMentions = useMemo((): LinkRow[] => {
    if (!itemId || !selectedItem) return [];
    return localItemsMentioningTitle(itemId, selectedItem.title, itemsRecord);
  }, [itemId, selectedItem, itemsRecord]);

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
    if (!itemId || !cloudMode) {
      setCloudLoading(false);
      return;
    }
    let cancelled = false;
    setCloudLoading(true);
    void (async () => {
      try {
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
        } else {
          setLoaded({
            itemId,
            outgoing: data.outgoing ?? [],
            incoming: data.incoming ?? [],
            err: null,
          });
        }
      } catch {
        if (!cancelled) {
          setLoaded({
            itemId,
            outgoing: [],
            incoming: [],
            err: "Could not load links",
          });
        }
      } finally {
        if (!cancelled) setCloudLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cloudMode, itemId]);

  if (!itemId) return null;

  const panelClass = `pointer-events-auto absolute right-3 top-3 z-[800] max-h-[min(78vh,520px)] w-[min(92vw,300px)] overflow-y-auto p-3 text-xs ${VIGIL_GLASS_PANEL}`;

  const mentionsBlock =
    selectedItem && selectedItem.title.trim().length >= 3 ? (
      <div className="mt-3 border-t border-[var(--vigil-border)]/70 pt-3">
        <p className="mb-1.5 text-[11px] leading-snug text-[var(--vigil-muted)]">
          Other cards whose text or title contains{" "}
          <span className="font-medium text-[var(--foreground)]">
            {selectedItem.title.trim()}
          </span>{" "}
          (local heuristic, not LLM).
        </p>
        {titleMentions.length > 0 ? (
          <LinkRowList label="Mentions" rows={titleMentions} onPick={focusItem} />
        ) : (
          <p className="text-[var(--vigil-muted)]">No matches on this canvas.</p>
        )}
      </div>
    ) : null;

  if (!cloudMode) {
    return (
      <div className={panelClass}>
        <div className="mb-2 flex items-center gap-2 font-semibold tracking-tight text-[var(--vigil-label)]">
          <LinkSimple
            className="size-4 shrink-0 text-[var(--vigil-muted)] opacity-90"
            weight="bold"
            aria-hidden
          />
          Links
        </div>
        <p className="mb-2.5 text-[11px] leading-snug text-[var(--vigil-muted)]">
          From TipTap <code className="rounded bg-black/5 px-0.5 dark:bg-white/10">[[</code>{" "}
          links on this canvas (local-only; not synced to Neon).
        </p>
        <WikiLinkSection
          localOutgoing={localOutgoing}
          localIncoming={localIncoming}
          focusItem={focusItem}
        />
        {mentionsBlock}
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
      <div className="mb-2 flex items-center gap-2 font-semibold tracking-tight text-[var(--vigil-label)]">
        <LinkSimple
          className="size-4 shrink-0 text-[var(--vigil-muted)] opacity-90"
          weight="bold"
          aria-hidden
        />
        Links
      </div>
      <p className="mb-2.5 text-[11px] leading-snug text-[var(--vigil-muted)]">
        Server <code className="text-[9px]">item_links</code> plus wiki text on other notes.
      </p>
      {cloudLoading && !inSync ? (
        <p className="text-[var(--vigil-muted)]">Loading links…</p>
      ) : err ? (
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
              <div className={`mb-1 ${VIGIL_METADATA_LABEL}`}>To</div>
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
              <div className={`mb-1 ${VIGIL_METADATA_LABEL}`}>From</div>
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
      {mentionsBlock}
    </div>
  );
}
