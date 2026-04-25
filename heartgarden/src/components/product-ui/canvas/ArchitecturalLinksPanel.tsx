"use client";

import { TreeStructure } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { CanvasGraph } from "@/src/components/foundation/architectural-types";
import { menuLabelForLinkType } from "@/src/lib/lore-link-types";
import { Button } from "@/src/components/ui/Button";
import { CanvasDebugInspectorShell } from "@/src/components/ui/CanvasDebugInspectorShell";
import debugInspectorStyles from "@/src/components/ui/CanvasDebugInspectorShell.module.css";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Endpoint = { id: string; title: string; itemType: string };

type CloudLoaded =
  | { outgoing: { linkId: string; linkType: string; to: Endpoint }[]; incoming: { linkId: string; linkType: string; from: Endpoint }[]; err: null }
  | { outgoing: []; incoming: []; err: string };

/** Inspector surfaces: canvas threads, persisted edges, and FTS related discovery. */
export function ArchitecturalLinksPanel({
  graph,
  activeSpaceId,
  selectedEntityIds,
  cloudEnabled,
  itemLinksRevision,
  onFocusEntity,
}: {
  graph: CanvasGraph;
  activeSpaceId: string;
  selectedEntityIds: readonly string[];
  cloudEnabled: boolean;
  itemLinksRevision?: string | null;
  onFocusEntity: (entityId: string) => void;
}) {
  const entityId = selectedEntityIds.length === 1 ? selectedEntityIds[0]! : null;
  const entity = entityId ? graph.entities[entityId] : undefined;

  const itemIdForCloud =
    entity && UUID_RE.test(entity.persistedItemId ?? entity.id)
      ? (entity.persistedItemId ?? entity.id)
      : entity && UUID_RE.test(entity.id)
        ? entity.id
        : null;

  const [cloud, setCloud] = useState<CloudLoaded | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [related, setRelated] = useState<{ id: string; title: string; itemType: string }[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  useEffect(() => {
    if (!itemIdForCloud || !cloudEnabled) {
      setCloud(null);
      setCloudLoading(false);
      return;
    }
    let cancelled = false;
    setCloudLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/items/${itemIdForCloud}/links`);
        const data = (await res.json()) as {
          ok?: boolean;
          outgoing?: { linkId: string; linkType: string; to: Endpoint }[];
          incoming?: { linkId: string; linkType: string; from: Endpoint }[];
          error?: string;
        };
        if (cancelled) return;
        if (!data.ok) {
          setCloud({ outgoing: [], incoming: [], err: data.error ?? "Could not load links" });
        } else {
          setCloud({
            outgoing: data.outgoing ?? [],
            incoming: data.incoming ?? [],
            err: null,
          });
        }
      } catch {
        if (!cancelled) setCloud({ outgoing: [], incoming: [], err: "Could not load links" });
      } finally {
        if (!cancelled) setCloudLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cloudEnabled, itemIdForCloud, itemLinksRevision]);

  useEffect(() => {
    if (!itemIdForCloud || !cloudEnabled) {
      setRelated([]);
      return;
    }
    let cancelled = false;
    setRelatedLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/items/${itemIdForCloud}/related?spaceId=${encodeURIComponent(activeSpaceId)}&limit=8`,
        );
        const data = (await res.json()) as {
          ok?: boolean;
          items?: { id: string; title: string; itemType: string }[];
        };
        if (cancelled) return;
        setRelated(data.ok && data.items ? data.items : []);
      } catch {
        if (!cancelled) setRelated([]);
      } finally {
        if (!cancelled) setRelatedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSpaceId, cloudEnabled, itemIdForCloud]);

  const canvasThreads = useMemo(() => {
    if (!entityId) return { count: 0, rows: [] as { peerId: string; title: string; tag: string }[] };
    const rows: { peerId: string; title: string; tag: string }[] = [];
    for (const c of Object.values(graph.connections)) {
      if (c.sourceEntityId === entityId) {
        const peer = graph.entities[c.targetEntityId];
        if (peer) {
          rows.push({
            peerId: peer.id,
            title: peer.title,
            tag: menuLabelForLinkType(c.linkType ?? "pin"),
          });
        }
      } else if (c.targetEntityId === entityId) {
        const peer = graph.entities[c.sourceEntityId];
        if (peer) {
          rows.push({
            peerId: peer.id,
            title: peer.title,
            tag: menuLabelForLinkType(c.linkType ?? "pin"),
          });
        }
      }
    }
    rows.sort((a, b) => a.title.localeCompare(b.title));
    return { count: rows.length, rows };
  }, [entityId, graph.connections, graph.entities]);

  const focus = useCallback(
    (id: string) => {
      onFocusEntity(id);
    },
    [onFocusEntity],
  );

  if (!entityId) return null;

  const serverTotal =
    cloud && !cloud.err ? cloud.outgoing.length + cloud.incoming.length : null;

  return (
    <CanvasDebugInspectorShell
      storageKey="hg-canvas-debug-links"
      title="Connections · inspector"
      defaultOpen={false}
    >
      <p className={`${debugInspectorStyles.debugInspectorIntro} mb-2`}>
        <span className="text-[var(--vigil-label)]">
          Canvas threads: {canvasThreads.count} · Persisted (Neon):{" "}
          {cloudEnabled && serverTotal !== null ? serverTotal : "—"}
        </span>
      </p>
      {!cloudEnabled ? (
        <p className={debugInspectorStyles.debugInspectorIntro}>
          Local canvas threads are ephemeral until sync. Sync to Neon for persisted{" "}
          <code className={debugInspectorStyles.debugInspectorCode}>
            item_links
          </code>{" "}
          rows.
        </p>
      ) : (
        <p className={debugInspectorStyles.debugInspectorIntro}>
          Persisted rows mirror drawn threads after sync. FTS &quot;related&quot; is discovery,
          not an authored link.
        </p>
      )}

      <div className={debugInspectorStyles.debugInspectorDivider}>
        <div className={debugInspectorStyles.debugInspectorSectionLabel}>Canvas threads (this space)</div>
        {canvasThreads.rows.length === 0 ? (
          <p className={debugInspectorStyles.debugInspectorMuted}>No threads touch this card.</p>
        ) : (
          <ul className={debugInspectorStyles.debugInspectorList}>
            {canvasThreads.rows.map((r, i) => (
              <li key={`${r.peerId}-${i}`}>
                <Button
                  size="sm"
                  variant="subtle"
                  tone="menu"
                  className="w-full justify-start truncate"
                  onClick={() => focus(r.peerId)}
                >
                  {r.title}
                  <span className="ml-1 text-[var(--vigil-muted)]">· {r.tag}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {cloudEnabled && itemIdForCloud ? (
        cloudLoading && !cloud ? (
          <p className={debugInspectorStyles.debugInspectorMuted}>Loading persisted edges…</p>
        ) : cloud?.err ? (
          <p className={debugInspectorStyles.debugInspectorError}>{cloud.err}</p>
        ) : cloud ? (
          <div className={debugInspectorStyles.debugInspectorStack}>
            <div className={debugInspectorStyles.debugInspectorSectionLabel}>
              Persisted edges (Neon item_links)
            </div>
            {cloud.outgoing.length > 0 ? (
              <div>
                <div className={debugInspectorStyles.debugInspectorSectionLabel}>Outgoing</div>
                <ul className={debugInspectorStyles.debugInspectorList}>
                  {cloud.outgoing.map((r) => (
                    <li key={r.linkId}>
                      <Button
                        size="sm"
                        variant="subtle"
                        tone="menu"
                        className="w-full justify-start truncate"
                        onClick={() => focus(r.to.id)}
                      >
                        {r.to.title}
                        <span className="ml-1 text-[var(--vigil-muted)]">
                          ({menuLabelForLinkType(r.linkType)}) · {r.to.itemType}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {cloud.incoming.length > 0 ? (
              <div>
                <div className={debugInspectorStyles.debugInspectorSectionLabel}>Incoming</div>
                <ul className={debugInspectorStyles.debugInspectorList}>
                  {cloud.incoming.map((r) => (
                    <li key={r.linkId}>
                      <Button
                        size="sm"
                        variant="subtle"
                        tone="menu"
                        className="w-full justify-start truncate"
                        onClick={() => focus(r.from.id)}
                      >
                        {r.from.title}
                        <span className="ml-1 text-[var(--vigil-muted)]">
                          ({menuLabelForLinkType(r.linkType)}) · {r.from.itemType}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {cloud.outgoing.length === 0 && cloud.incoming.length === 0 ? (
              <p className={debugInspectorStyles.debugInspectorMuted}>
                No persisted edges for this item yet.
              </p>
            ) : null}
          </div>
        ) : null
      ) : null}

      {cloudEnabled && itemIdForCloud ? (
        <div className={debugInspectorStyles.debugInspectorDivider}>
          <div className={debugInspectorStyles.debugInspectorRelatedHeading}>
            <TreeStructure size={14} weight="bold" aria-hidden />
            <span>Related (discovery · FTS)</span>
          </div>
          {relatedLoading ? (
            <p className={debugInspectorStyles.debugInspectorMuted}>Loading…</p>
          ) : related.length === 0 ? (
            <p className={debugInspectorStyles.debugInspectorMuted}>
              No strong matches in this space.
            </p>
          ) : (
            <ul className={debugInspectorStyles.debugInspectorList}>
              {related.map((r) => (
                <li key={r.id}>
                  <Button
                    size="sm"
                    variant="subtle"
                    tone="menu"
                    className="w-full justify-start truncate"
                    onClick={() => focus(r.id)}
                  >
                    {r.title}
                    <span className="ml-1 text-[var(--vigil-muted)]">({r.itemType})</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </CanvasDebugInspectorShell>
  );
}
