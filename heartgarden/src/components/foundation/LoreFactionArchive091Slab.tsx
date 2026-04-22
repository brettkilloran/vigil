"use client";

import { ArrowsOutSimple } from "@phosphor-icons/react";
import type { JSONContent } from "@tiptap/core";
import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { HeartgardenDocEditor } from "@/src/components/editing/HeartgardenDocEditor";
import { ArchitecturalTooltip } from "@/src/components/foundation/ArchitecturalTooltip";
import { Button } from "@/src/components/ui/Button";
import cardStyles from "@/src/components/foundation/lore-entity-card.module.css";
import { cx } from "@/src/lib/cx";
import type { FactionRosterEntry } from "@/src/lib/faction-roster-schema";
import {
  buildFactionArchive091BodyHtml,
  FACTION_ARCHIVE091_READABLE_DEFAULT_RECORD_HTML,
  factionArchiveRailTextsFromObjectId,
  parseFactionArchive091BodyHtml,
} from "@/src/lib/lore-faction-archive-html";
import { htmlFragmentToHgDocDoc } from "@/src/lib/hg-doc/html-to-doc";
import { hgDocToHtml } from "@/src/lib/hg-doc/html-export";
import { LORE_V9_REDACTED_SENTINEL } from "@/src/lib/lore-v9-placeholder";
import {
  consumeLorePlaceholderBeforeInput,
  installLorePlaceholderSelectionGuards,
  placeCaretAfterLorePlaceholderReplace,
  syncLoreV9RedactedPlaceholderState,
} from "@/src/lib/lore-v9-placeholder";
import { installLoreV11PlaceholderCaretSync } from "@/src/lib/lore-v11-ph-caret";

function fillHeadingHtml(el: HTMLElement, html: string) {
  const t = html.trim();
  if (!t || t === LORE_V9_REDACTED_SENTINEL) {
    el.textContent = LORE_V9_REDACTED_SENTINEL;
    return;
  }
  el.innerHTML = t;
}

export type LoreFactionArchive091SlabProps = {
  nodeId: string;
  bodyHtml: string;
  factionRoster: FactionRosterEntry[];
  labTestId?: string;
  editable: boolean;
  onCommit: (html: string) => void;
  onDraftDirty?: (dirty: boolean) => void;
  emptyPlaceholder?: string | null;
};

export function LoreFactionArchive091Slab({
  nodeId,
  bodyHtml,
  factionRoster,
  labTestId,
  editable,
  onCommit,
  onDraftDirty,
  emptyPlaceholder,
}: LoreFactionArchive091SlabProps) {
  const parsed = useMemo(() => parseFactionArchive091BodyHtml(bodyHtml), [bodyHtml]);

  const [orgPrimaryHtml, setOrgPrimaryHtml] = useState(
    () => parsed?.orgPrimaryInnerHtml ?? LORE_V9_REDACTED_SENTINEL,
  );
  const [orgAccentHtml, setOrgAccentHtml] = useState(
    () => parsed?.orgAccentInnerHtml ?? LORE_V9_REDACTED_SENTINEL,
  );
  const [recordDoc, setRecordDoc] = useState<JSONContent>(() => {
    const rec = parsed?.recordInnerHtml ?? "";
    return htmlFragmentToHgDocDoc(rec.trim() ? rec : FACTION_ARCHIVE091_READABLE_DEFAULT_RECORD_HTML);
  });

  const recordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushed = useRef(bodyHtml);
  const rootRef = useRef<HTMLDivElement>(null);
  const recordInnerRef = useRef<HTMLDivElement>(null);
  const recordMaskSyncRef = useRef<(() => void) | null>(null);
  const letterheadShellRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLHeadingElement>(null);
  const accentRef = useRef<HTMLDivElement>(null);

  const { upper: railUpper, lower: railLower } = useMemo(
    () =>
      parsed
        ? { upper: parsed.railUpper, lower: parsed.railLower }
        : factionArchiveRailTextsFromObjectId(nodeId),
    [parsed, nodeId],
  );

  useLayoutEffect(() => {
    const shell = letterheadShellRef.current;
    if (!shell) return;
    syncLoreV9RedactedPlaceholderState(shell);
    const removeGuards = installLorePlaceholderSelectionGuards(shell);
    const removePhCaret = installLoreV11PlaceholderCaretSync(shell);
    const onInput = () => {
      syncLoreV9RedactedPlaceholderState(shell);
    };
    const onBeforeInput = (e: Event) => {
      const ie = e as InputEvent;
      const field = (ie.target as HTMLElement | null)?.closest?.("[data-hg-lore-field]");
      if (!field || !(field instanceof HTMLElement) || !shell.contains(field)) return;
      if (!consumeLorePlaceholderBeforeInput(field, ie)) return;
      syncLoreV9RedactedPlaceholderState(shell);
      queueMicrotask(() => {
        if (field.isConnected) placeCaretAfterLorePlaceholderReplace(field);
      });
    };
    const onFocusOut = () => {
      queueMicrotask(() => syncLoreV9RedactedPlaceholderState(shell));
    };
    shell.addEventListener("beforeinput", onBeforeInput, true);
    shell.addEventListener("input", onInput, true);
    shell.addEventListener("focusout", onFocusOut);
    return () => {
      removeGuards();
      removePhCaret();
      shell.removeEventListener("beforeinput", onBeforeInput, true);
      shell.removeEventListener("input", onInput, true);
      shell.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  useLayoutEffect(() => {
    const el = primaryRef.current;
    if (el) fillHeadingHtml(el, orgPrimaryHtml);
    const a = accentRef.current;
    if (a) fillHeadingHtml(a, orgAccentHtml);
    syncLoreV9RedactedPlaceholderState(letterheadShellRef.current);
  }, [orgPrimaryHtml, orgAccentHtml]);

  useLayoutEffect(() => {
    const parent = recordInnerRef.current;
    if (!parent) return;

    const edgePx = 1;
    const syncDocScrollMask = (el: HTMLElement) => {
      const sh = el.scrollHeight;
      const ch = el.clientHeight;
      const maxScroll = sh - ch;
      if (maxScroll <= 0.5) {
        el.removeAttribute("data-hg-fac-arxx-doc-mask");
        return;
      }
      const st = el.scrollTop;
      const distanceFromBottom = Math.max(0, sh - st - ch);
      const nearTop = st <= edgePx;
      const nearBottom =
        distanceFromBottom <= edgePx && (st > edgePx || distanceFromBottom < 0.5);
      if (nearTop && !nearBottom) {
        el.setAttribute("data-hg-fac-arxx-doc-mask", "end");
      } else if (!nearTop && nearBottom) {
        el.setAttribute("data-hg-fac-arxx-doc-mask", "start");
      } else {
        el.setAttribute("data-hg-fac-arxx-doc-mask", "both");
      }
    };

    let host: HTMLElement | null = null;
    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;

    const onScroll = () => {
      if (host) syncDocScrollMask(host);
    };

    const onInput = () => {
      if (host) syncDocScrollMask(host);
    };

    const detachHost = () => {
      if (!host) return;
      host.removeAttribute("data-hg-fac-arxx-doc-mask");
      host.removeEventListener("scroll", onScroll);
      host.removeEventListener("input", onInput);
      ro?.disconnect();
      ro = null;
      host = null;
    };

    const syncMountedHost = () => {
      if (host) syncDocScrollMask(host);
    };
    recordMaskSyncRef.current = syncMountedHost;

    const attachHost = (el: HTMLElement) => {
      detachHost();
      host = el;
      host.addEventListener("scroll", onScroll, { passive: true });
      host.addEventListener("input", onInput);
      ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => syncDocScrollMask(el)) : null;
      ro?.observe(el);
      queueMicrotask(() => syncDocScrollMask(el));
    };

    const tryAttach = () => {
      const el = parent.querySelector<HTMLElement>('[data-hg-doc-editor="true"]');
      if (el) {
        mo?.disconnect();
        mo = null;
        attachHost(el);
        return true;
      }
      return false;
    };

    if (!tryAttach()) {
      mo = new MutationObserver(() => {
        tryAttach();
      });
      mo.observe(parent, { childList: true, subtree: true });
    }

    return () => {
      recordMaskSyncRef.current = null;
      mo?.disconnect();
      detachHost();
    };
  }, [nodeId]);

  useLayoutEffect(() => {
    queueMicrotask(() => recordMaskSyncRef.current?.());
  }, [recordDoc]);

  useEffect(() => {
    if (bodyHtml === lastPushed.current) return;
    lastPushed.current = bodyHtml;
    const p = parseFactionArchive091BodyHtml(bodyHtml);
    startTransition(() => {
      if (p) {
        setOrgPrimaryHtml(p.orgPrimaryInnerHtml);
        setOrgAccentHtml(p.orgAccentInnerHtml);
        const rec = p.recordInnerHtml ?? "";
        setRecordDoc(
          htmlFragmentToHgDocDoc(rec.trim() ? rec : FACTION_ARCHIVE091_READABLE_DEFAULT_RECORD_HTML),
        );
      } else {
        const { upper, lower } = factionArchiveRailTextsFromObjectId(nodeId);
        const seed = buildFactionArchive091BodyHtml({
          orgPrimaryInnerHtml: "",
          orgAccentInnerHtml: "",
          recordInnerHtml: "",
          railUpper: upper,
          railLower: lower,
        });
        const pr = parseFactionArchive091BodyHtml(seed);
        if (pr) {
          setOrgPrimaryHtml(pr.orgPrimaryInnerHtml);
          setOrgAccentHtml(pr.orgAccentInnerHtml);
          setRecordDoc(htmlFragmentToHgDocDoc(pr.recordInnerHtml));
        }
      }
    });
  }, [bodyHtml, nodeId]);

  const pushHtml = useCallback(
    (p: { orgPrimaryInnerHtml: string; orgAccentInnerHtml: string; recordInnerHtml: string }) => {
      const { upper, lower } = factionArchiveRailTextsFromObjectId(nodeId);
      const html = buildFactionArchive091BodyHtml({
        orgPrimaryInnerHtml: p.orgPrimaryInnerHtml,
        orgAccentInnerHtml: p.orgAccentInnerHtml,
        recordInnerHtml: p.recordInnerHtml,
        railUpper: upper,
        railLower: lower,
      });
      lastPushed.current = html;
      onCommit(html);
      onDraftDirty?.(false);
    },
    [nodeId, onCommit, onDraftDirty],
  );

  const flushLetterhead = useCallback(() => {
    const pEl = primaryRef.current;
    const aEl = accentRef.current;
    const nextP = (pEl?.innerHTML ?? "").trim() || LORE_V9_REDACTED_SENTINEL;
    const nextA = (aEl?.innerHTML ?? "").trim() || LORE_V9_REDACTED_SENTINEL;
    setOrgPrimaryHtml(nextP);
    setOrgAccentHtml(nextA);
    onDraftDirty?.(true);
    pushHtml({
      orgPrimaryInnerHtml: nextP,
      orgAccentInnerHtml: nextA,
      recordInnerHtml: hgDocToHtml(recordDoc),
    });
  }, [pushHtml, recordDoc, onDraftDirty]);

  const scheduleRecordCommit = useCallback(
    (nextDoc: JSONContent) => {
      onDraftDirty?.(true);
      if (recordTimer.current) clearTimeout(recordTimer.current);
      recordTimer.current = setTimeout(() => {
        recordTimer.current = null;
        pushHtml({
          orgPrimaryInnerHtml: orgPrimaryHtml,
          orgAccentInnerHtml: orgAccentHtml,
          recordInnerHtml: hgDocToHtml(nextDoc),
        });
      }, 320);
    },
    [orgPrimaryHtml, orgAccentHtml, onDraftDirty, pushHtml],
  );

  useEffect(
    () => () => {
      if (recordTimer.current) clearTimeout(recordTimer.current);
    },
    [],
  );

  const rosterCount = factionRoster.length;

  return (
    <div
      ref={rootRef}
      className={cardStyles.facArxxRoot}
      data-testid={labTestId}
      data-hg-canvas-role="lore-faction"
      data-hg-lore-faction-variant="archive091"
      data-hg-lore-ordo-node-id={nodeId}
    >
      <div className={cardStyles.facArxxGrain} aria-hidden />
      <div className={cardStyles.facArxxPage}>
        <aside className={cardStyles.facArxxRail} aria-hidden>
          <div className={cardStyles.facArxxVertical} data-hg-faction-archive-rail="upper">
            {railUpper}
          </div>
          <svg className={cardStyles.facArxxStar} viewBox="0 0 24 24" aria-hidden>
            <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" fill="currentColor" />
          </svg>
          <div className={cardStyles.facArxxVertical} data-hg-faction-archive-rail="lower">
            {railLower}
          </div>
          <div className={cardStyles.facArxxBarcode} aria-hidden />
        </aside>

        <div className={cardStyles.facArxxMain}>
          <div
            className={cardStyles.facArxxFocusTop}
            data-hg-faction-archive-drag-handle="true"
          >
            <div className={cardStyles.facArxxPlateHeader}>
              <span className={cardStyles.facArxxPlateHeaderTitle}>Faction</span>
              <div className={cardStyles.facArxxPlateHeaderActions}>
                <ArchitecturalTooltip content="Focus Mode" side="bottom" delayMs={320}>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    tone="card-dark"
                    className={cardStyles.facArxxPlateHeaderBtn}
                    data-expand-btn="true"
                    aria-label="Focus Mode"
                    onClick={() => {}}
                  >
                    <ArrowsOutSimple size={14} weight="regular" />
                  </Button>
                </ArchitecturalTooltip>
              </div>
            </div>
          </div>

          <div className={cardStyles.facArxxRule} role="presentation" aria-hidden />

          <header className={cardStyles.facArxxLetterhead}>
            <div
              ref={letterheadShellRef}
              className={cx(cardStyles.charSkShellV11, cardStyles.facArxxLetterheadPh)}
            >
              <h1
                ref={primaryRef}
                className={cx(cardStyles.charSkDisplayName, cardStyles.facArxxLetterheadPrimary)}
                contentEditable={editable}
                spellCheck={false}
                suppressContentEditableWarning
                data-hg-lore-field="1"
                data-hg-lore-placeholder="true"
                data-hg-lore-ph={LORE_V9_REDACTED_SENTINEL}
                data-hg-lore-faction-field="orgNamePrimary"
                onBlur={flushLetterhead}
              />
              <div
                ref={accentRef}
                className={cx(cardStyles.charSkRole, cardStyles.facArxxLetterheadSecondary)}
                contentEditable={editable}
                spellCheck={false}
                suppressContentEditableWarning
                data-hg-lore-field="1"
                data-hg-lore-placeholder="true"
                data-hg-lore-ph={LORE_V9_REDACTED_SENTINEL}
                data-hg-lore-faction-field="orgNameAccent"
                onBlur={flushLetterhead}
              />
            </div>
          </header>

          <div className={cardStyles.facArxxRule} role="presentation" aria-hidden />

          <div className={cardStyles.facArxxTextSection}>
            <div className={cardStyles.facArxxH2Row}>
              <h2 className={cardStyles.facArxxH2}>Member index</h2>
              <span className={cardStyles.facArxxH2Meta}>
                {rosterCount} record{rosterCount === 1 ? "" : "s"}
              </span>
            </div>
            <div
              className={cardStyles.facArxxRosterCanvasList}
              data-hg-lore-faction-roster="1"
              contentEditable={false}
            >
              {factionRoster.length === 0 ? (
                <div className={cardStyles.facArxxRosterCanvasEmpty} role="status">
                  <p className={cardStyles.facArxxRosterCanvasEmptyTitle}>No known members</p>
                </div>
              ) : (
                factionRoster.map((row) => {
                  const primary =
                    row.kind === "character"
                      ? row.displayNameOverride?.trim() || `Character ${row.characterItemId.slice(0, 8)}…`
                      : row.label.trim() || "Member";
                  const secondary =
                    row.kind === "character"
                      ? row.roleOverride?.trim() || null
                      : row.role?.trim() || null;
                  return (
                    <div
                      key={row.id}
                      className={cardStyles.facArxxRosterCanvasRow}
                      role="listitem"
                      data-faction-roster-entry-id={row.id}
                      data-faction-roster-kind={row.kind}
                    >
                      <div className={cardStyles.facArxxRosterCanvasRowText}>{primary}</div>
                      {secondary ? (
                        <div className={cardStyles.facArxxRosterCanvasRowMeta}>{secondary}</div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className={cardStyles.facArxxRule} role="presentation" aria-hidden />

          <div className={cardStyles.facArxxTextSection}>
            <h2 className={cardStyles.facArxxH2}>Record</h2>
            <div
              className={cardStyles.facArxxRecordCell}
              data-hg-lore-faction-record-cell="true"
              contentEditable={false}
            >
              <div
                ref={recordInnerRef}
                data-hg-lore-faction-record="true"
                contentEditable={false}
                className={cardStyles.facArxxRecordInner}
              >
                <HeartgardenDocEditor
                  surfaceKey={`faction-archive-091-record-${nodeId}`}
                  chromeRole="canvas"
                  value={recordDoc}
                  editable={editable}
                  onChange={(next) => {
                    setRecordDoc(next);
                    scheduleRecordCommit(next);
                    queueMicrotask(() => recordMaskSyncRef.current?.());
                  }}
                  showAiPendingGutter={false}
                  placeholder={emptyPlaceholder ?? "Record… type / for blocks"}
                  className={cardStyles.facArxxHgHost}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
