"use client";

import { TreeStructure } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/src/components/ui/Button";
import { CanvasDebugInspectorShell } from "@/src/components/ui/CanvasDebugInspectorShell";
import type { CanvasContentEntity, CanvasGraph } from "@/src/components/foundation/architectural-types";
import { HEARTGARDEN_METADATA_LABEL } from "@/src/lib/vigil-ui-classes";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractVigilIdsFromHtml(html: string): string[] {
  const re = /vigil:item:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.add(m[1]!.toLowerCase());
  return [...out];
}

function wikiTargetsFromEntity(entity: CanvasContentEntity): string[] {
  return extractVigilIdsFromHtml(entity.bodyHtml ?? "");
}

type Endpoint = { id: string; title: string; itemType: string };

type CloudLoaded =
  | { outgoing: { linkId: string; linkType: string; to: Endpoint }[]; incoming: { linkId: string; linkType: string; from: Endpoint }[]; err: null }
  | { outgoing: []; incoming: []; err: string };

function RowList({
  label,
  rows,
  onPick,
}: {
  label: string;
  rows: Endpoint[];
  onPick: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className={`mb-1 ${HEARTGARDEN_METADATA_LABEL}`}>{label}</div>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={r.id}>
            <Button
              size="sm"
              variant="subtle"
              tone="menu"
              className="w-full justify-start truncate"
              onClick={() => onPick(r.id)}
            >
              {r.title}
              <span className="ml-1 text-[var(--vigil-muted)]">({r.itemType})</span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Links + related items for the architectural canvas (Neon `item_links`, wiki targets in HTML, FTS “related”).
 */
export function ArchitecturalLinksPanel({
  graph,
  activeSpaceId,
  selectedEntityIds,
  cloudEnabled,
  onFocusEntity,
}: {
  graph: CanvasGraph;
  activeSpaceId: string;
  selectedEntityIds: readonly string[];
  cloudEnabled: boolean;
  onFocusEntity: (entityId: string) => void;
}) {
  const entityId = selectedEntityIds.length === 1 ? selectedEntityIds[0]! : null;
  const entity = entityId ? graph.entities[entityId] : undefined;
  const visibleIds = graph.spaces[activeSpaceId]?.entityIds ?? [];

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
  }, [cloudEnabled, itemIdForCloud]);

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

  const localWiki = useMemo(() => {
    if (!entityId || !entity || entity.kind !== "content") {
      return { outgoing: [] as Endpoint[], incoming: [] as Endpoint[] };
    }
    const targets = wikiTargetsFromEntity(entity);
    const outgoing: Endpoint[] = [];
    const seen = new Set<string>();
    for (const raw of targets) {
      const id = visibleIds.find((vid) => vid.toLowerCase() === raw) ?? null;
      if (!id || id === entityId) continue;
      const peer = graph.entities[id];
      if (!peer) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      outgoing.push({
        id,
        title: peer.title,
        itemType: peer.kind === "folder" ? "folder" : peer.theme,
      });
    }
    outgoing.sort((a, b) => a.title.localeCompare(b.title));

    const incoming: Endpoint[] = [];
    for (const vid of visibleIds) {
      if (vid === entityId) continue;
      const peer = graph.entities[vid];
      if (!peer || peer.kind !== "content") continue;
      const t = wikiTargetsFromEntity(peer);
      if (!t.some((x) => x === entityId.toLowerCase())) continue;
      incoming.push({
        id: vid,
        title: peer.title,
        itemType: peer.theme,
      });
    }
    incoming.sort((a, b) => a.title.localeCompare(b.title));
    return { outgoing, incoming };
  }, [entity, entityId, graph, visibleIds]);

  const focus = useCallback(
    (id: string) => {
      onFocusEntity(id);
    },
    [onFocusEntity],
  );

  if (!entityId) return null;

  return (
    <CanvasDebugInspectorShell storageKey="hg-canvas-debug-links" title="Debug // Link inspector" defaultOpen={false}>
      {!cloudEnabled ? (
        <p className="mb-2.5 text-[11px] leading-snug text-[var(--vigil-muted)]">
          Local canvas — <code className="rounded bg-black/5 px-0.5 dark:bg-white/10">[[</code> wiki
          targets and <code className="text-[9px]">vigil:item:</code> in note HTML. Sync to Neon for
          server links.
        </p>
      ) : (
        <p className="mb-2.5 text-[11px] leading-snug text-[var(--vigil-muted)]">
          Neon <code className="text-[9px]">item_links</code>, wiki targets, and FTS-related cards in
          this space.
        </p>
      )}

      {cloudEnabled && itemIdForCloud ? (
        cloudLoading && !cloud ? (
          <p className="text-[var(--vigil-muted)]">Loading server links…</p>
        ) : cloud?.err ? (
          <p className="text-red-600 dark:text-red-400">{cloud.err}</p>
        ) : cloud ? (
          <div className="space-y-2.5">
            {cloud.outgoing.length > 0 ? (
              <div>
                <div className={`mb-1 ${HEARTGARDEN_METADATA_LABEL}`}>To (server)</div>
                <ul className="space-y-0.5">
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
                          ({r.linkType}) · {r.to.itemType}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {cloud.incoming.length > 0 ? (
              <div>
                <div className={`mb-1 ${HEARTGARDEN_METADATA_LABEL}`}>From (server)</div>
                <ul className="space-y-0.5">
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
                          ({r.linkType}) · {r.from.itemType}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {cloud.outgoing.length === 0 && cloud.incoming.length === 0 ? (
              <p className="text-[var(--vigil-muted)]">No server links for this card yet.</p>
            ) : null}
          </div>
        ) : null
      ) : null}

      {entity?.kind === "content" ? (
        <div className="mt-2 border-t border-[var(--vigil-border)]/70 pt-2">
          <div className={`mb-1 ${HEARTGARDEN_METADATA_LABEL}`}>Wiki on this space</div>
          <RowList label="Out" rows={localWiki.outgoing} onPick={focus} />
          <RowList label="In" rows={localWiki.incoming} onPick={focus} />
          {localWiki.outgoing.length === 0 && localWiki.incoming.length === 0 ? (
            <p className="text-[var(--vigil-muted)]">No vigil:item / HTML wiki targets yet.</p>
          ) : null}
        </div>
      ) : null}

      {cloudEnabled && itemIdForCloud ? (
        <div className="mt-3 border-t border-[var(--vigil-border)]/70 pt-3">
          <div className="mb-1 flex items-center gap-1.5 text-[var(--vigil-label)]">
            <TreeStructure className="size-3.5 text-[var(--vigil-muted)]" weight="bold" aria-hidden />
            <span className={HEARTGARDEN_METADATA_LABEL}>Related (FTS)</span>
          </div>
          {relatedLoading ? (
            <p className="text-[var(--vigil-muted)]">Loading…</p>
          ) : related.length === 0 ? (
            <p className="text-[var(--vigil-muted)]">No strong matches in this space.</p>
          ) : (
            <ul className="space-y-0.5">
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
