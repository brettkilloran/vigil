"use client";

import { ArrowsOutSimple } from "@phosphor-icons/react";
import type { JSONContent } from "@tiptap/core";
import type {
  MutableRefObject,
  ClipboardEvent as ReactClipboardEvent,
  DragEvent as ReactDragEvent,
} from "react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { HeartgardenDocEditor } from "@/src/components/editing/HeartgardenDocEditor";
import { ArchitecturalTooltip } from "@/src/components/foundation/ArchitecturalTooltip";
import cardStyles from "@/src/components/foundation/lore-entity-card.module.css";
import { Button } from "@/src/components/ui/Button";
import { cx } from "@/src/lib/cx";
import { getHgDocEditor } from "@/src/lib/hg-doc/editor-registry";
import { hgDocToHtml } from "@/src/lib/hg-doc/html-export";
import { htmlFragmentToHgDocDoc } from "@/src/lib/hg-doc/html-to-doc";
import {
  computeLocationTopFieldPasteInsertText,
  insertPlainTextIntoContentEditable,
  LORE_V11_PH_LOCATION_PLACEHOLDER,
  normalizeLocOrdoV7NameField,
  parseLocationOrdoV7BodyPlainFields,
  shouldBlockLocationTopFieldBeforeInput,
} from "@/src/lib/lore-location-focus-document-html";
import { splitOrdoV7DisplayName } from "@/src/lib/lore-location-ordo-display-name";
import {
  buildLocationOrdoV7BodyHtml,
  LORE_V11_PH_LOCATION_CONTEXT,
} from "@/src/lib/lore-node-seed-html";
import { ordoV7StaplePlacementFromSeed } from "@/src/lib/lore-v7-staple-placement";
import {
  consumeLorePlaceholderBeforeInput,
  installLorePlaceholderSelectionGuards,
} from "@/src/lib/lore-v9-placeholder";
import { syncLoreV11MarkerTilts } from "@/src/lib/lore-v11-marker-tilt";
import {
  installLoreV11PlaceholderCaretSync,
  syncLoreV11PhCaretOffsetsInHost,
} from "@/src/lib/lore-v11-ph-caret";

/**
 * ORDO v7 `contentEditable` fields must not use React-managed children: the browser mutates the DOM
 * while typing, and other state updates (e.g. notes editor) re-render and reconcile against stale
 * VDOM — causing `removeChild` NotFoundError (often reported at `<br>`).
 */
function fillOrdoV7NameFieldDOM(el: HTMLElement, name: string) {
  const nameEmpty = normalizeLocOrdoV7NameField(name) === "";
  if (nameEmpty) {
    el.replaceChildren(document.createElement("br"));
    return;
  }
  const { line1, line2 } = splitOrdoV7DisplayName(name);
  el.textContent = "";
  el.appendChild(document.createTextNode(line1));
  if (line2) {
    el.appendChild(document.createElement("br"));
    el.appendChild(document.createTextNode(line2));
  }
}

/**
 * Notes are considered empty when the doc has no blocks, or a single empty paragraph.
 * Mirrors TipTap's `editor.isEmpty` semantics without needing the live editor instance.
 */
function isNotesHgDocEmpty(doc: JSONContent | null | undefined): boolean {
  if (!doc || doc.type !== "doc") {
    return true;
  }
  const content = doc.content ?? [];
  if (content.length === 0) {
    return true;
  }
  if (content.length === 1) {
    const only = content[0];
    if (only?.type === "paragraph" && !only.content?.length) {
      return true;
    }
  }
  return false;
}

function fillOrdoV7SingleLineFieldDOM(el: HTMLElement, raw: string) {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) {
    el.replaceChildren(document.createElement("br"));
    return;
  }
  el.textContent = t;
}

function handleTopFieldPaste(
  field: "name" | "context" | "detail",
  e: ReactClipboardEvent<HTMLElement>
) {
  const el = e.currentTarget as HTMLElement;
  const clipped = computeLocationTopFieldPasteInsertText(
    field,
    el,
    e.clipboardData.getData("text/plain")
  );
  e.preventDefault();
  if (!clipped) {
    return;
  }
  insertPlainTextIntoContentEditable(el, clipped);
}

function handleTopFieldDrop(e: ReactDragEvent<HTMLElement>) {
  e.preventDefault();
}

/** Same grid as lab `FAC_ORDO_PIXEL_GRID`. */
const ORDO_V7_LOGO_PIXEL_GRID: readonly (0 | 1)[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
];

/** Shared top-edge pin: same anchor + seed as staple; switches metal drawing only (Option B). */
export function OrdoV7TopPin({
  kind,
  nodeId,
  labTestId,
  tapeRotationDeg,
}: {
  kind: "staple" | "nail";
  nodeId: string;
  labTestId?: string;
  tapeRotationDeg?: number;
}) {
  const seed = labTestId ?? nodeId;
  const style = ordoV7StaplePlacementFromSeed(seed, tapeRotationDeg);
  return (
    <span
      aria-hidden
      className={cardStyles.locOrdoV7Staple}
      data-hg-lore-location-nail={kind === "nail" ? "v7-unified" : undefined}
      data-hg-lore-location-staple={kind === "staple" ? "v7" : undefined}
      style={style}
    >
      <span
        aria-hidden
        className={
          kind === "staple"
            ? cardStyles.locOrdoV7StapleMetal
            : cardStyles.locOrdoV7NailMetal
        }
      />
    </span>
  );
}

/** Option A: duplicate positioning shell (`.locOrdoV7NailParallel`) + shared nail metal — lab / comparison only. */
export function OrdoV7NailParallel({
  nodeId,
  labTestId,
  tapeRotationDeg,
}: {
  nodeId: string;
  labTestId?: string;
  tapeRotationDeg?: number;
}) {
  const seed = labTestId ?? nodeId;
  const style = ordoV7StaplePlacementFromSeed(seed, tapeRotationDeg);
  return (
    <span
      aria-hidden
      className={cardStyles.locOrdoV7NailParallel}
      data-hg-lore-location-nail="v7-parallel"
      style={style}
    >
      <span aria-hidden className={cardStyles.locOrdoV7NailMetal} />
    </span>
  );
}

function OrdoV7Staple({
  nodeId,
  labTestId,
  tapeRotationDeg,
}: {
  nodeId: string;
  labTestId?: string;
  tapeRotationDeg?: number;
}) {
  return (
    <OrdoV7TopPin
      kind="staple"
      labTestId={labTestId}
      nodeId={nodeId}
      tapeRotationDeg={tapeRotationDeg}
    />
  );
}

const TitleAndContext = memo(function TitleAndContext({
  name,
  context,
  onNameDraftChange,
  onContextDraftChange,
  onNameCommit,
  onContextCommit,
  editable,
}: {
  name: string;
  context: string;
  /** Live plain text while editing — updates placeholder/redaction attrs before blur (data model still commits on blur / notes timer). */
  onNameDraftChange: (next: string) => void;
  onContextDraftChange: (next: string) => void;
  onNameCommit: (next: string) => void;
  onContextCommit: (next: string) => void;
  editable: boolean;
}) {
  const nameEmpty = normalizeLocOrdoV7NameField(name) === "";
  const contextEmpty = !context.trim();

  const nameElRef = useRef<HTMLHeadingElement>(null);
  const nameFocusedRef = useRef(false);
  const ctxElRef = useRef<HTMLParagraphElement>(null);
  const ctxFocusedRef = useRef(false);

  useLayoutEffect(() => {
    const el = nameElRef.current;
    if (!el || nameFocusedRef.current) {
      return;
    }
    fillOrdoV7NameFieldDOM(el, name);
  }, [name]);

  useLayoutEffect(() => {
    const el = ctxElRef.current;
    if (!el || ctxFocusedRef.current) {
      return;
    }
    fillOrdoV7SingleLineFieldDOM(el, context);
  }, [context]);

  return (
    <>
      <div className={cardStyles.locOrdoV7TitleRow}>
        <h1
          className={cardStyles.locOrdoV7DisplayTitle}
          contentEditable={editable}
          data-hg-lore-field="name"
          data-hg-lore-location-field="name"
          data-hg-lore-ph={
            nameEmpty ? LORE_V11_PH_LOCATION_PLACEHOLDER : undefined
          }
          data-hg-lore-placeholder={nameEmpty ? "true" : undefined}
          onBeforeInput={(e) => {
            if (!editable) {
              return;
            }
            const el = e.currentTarget as HTMLElement;
            const native = e.nativeEvent;
            if (
              native instanceof InputEvent &&
              shouldBlockLocationTopFieldBeforeInput("name", el, native)
            ) {
              e.preventDefault();
              return;
            }
            if (
              native instanceof InputEvent &&
              consumeLorePlaceholderBeforeInput(el, native)
            ) {
              queueMicrotask(() => {
                const t = el.innerText
                  .replace(/\n/g, " ")
                  .replace(/\s+/g, " ")
                  .trim();
                onNameCommit(normalizeLocOrdoV7NameField(t));
              });
            }
          }}
          onBlur={(e) => {
            nameFocusedRef.current = false;
            const t = e.currentTarget.innerText
              .replace(/\n/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            onNameCommit(normalizeLocOrdoV7NameField(t));
          }}
          onDrop={(e) => {
            if (!editable) {
              return;
            }
            handleTopFieldDrop(e);
          }}
          onFocus={() => {
            nameFocusedRef.current = true;
          }}
          onInput={(e) => {
            const t = e.currentTarget.innerText
              .replace(/\n/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            onNameDraftChange(normalizeLocOrdoV7NameField(t));
          }}
          onPaste={(e) => {
            if (!editable) {
              return;
            }
            handleTopFieldPaste("name", e);
          }}
          ref={nameElRef}
          suppressContentEditableWarning
        />
      </div>
      {/* Row shell: clips guest-check ::after so it cannot paint into the title (character meta row pattern). */}
      <div className={cardStyles.locOrdoV7ContextSlot}>
        <p
          className={cardStyles.locOrdoV7ContextLine}
          contentEditable={editable}
          data-hg-lore-field="1"
          data-hg-lore-location-field="context"
          data-hg-lore-ph={
            contextEmpty ? LORE_V11_PH_LOCATION_CONTEXT : undefined
          }
          data-hg-lore-placeholder={contextEmpty ? "true" : undefined}
          onBeforeInput={(e) => {
            if (!editable) {
              return;
            }
            const el = e.currentTarget as HTMLElement;
            const native = e.nativeEvent;
            if (
              native instanceof InputEvent &&
              shouldBlockLocationTopFieldBeforeInput("context", el, native)
            ) {
              e.preventDefault();
              return;
            }
            if (
              native instanceof InputEvent &&
              consumeLorePlaceholderBeforeInput(el, native)
            ) {
              queueMicrotask(() => {
                onContextCommit(el.innerText.replace(/\s+/g, " ").trim());
              });
            }
          }}
          onBlur={(e) => {
            ctxFocusedRef.current = false;
            onContextCommit(
              e.currentTarget.innerText.replace(/\s+/g, " ").trim()
            );
          }}
          onDrop={(e) => {
            if (!editable) {
              return;
            }
            handleTopFieldDrop(e);
          }}
          onFocus={() => {
            ctxFocusedRef.current = true;
          }}
          onInput={(e) => {
            const t = e.currentTarget.innerText.replace(/\s+/g, " ").trim();
            onContextDraftChange(t);
          }}
          onPaste={(e) => {
            if (!editable) {
              return;
            }
            handleTopFieldPaste("context", e);
          }}
          ref={ctxElRef}
          spellCheck={false}
          suppressContentEditableWarning
        />
      </div>
    </>
  );
});

const DetailLine = memo(function DetailLine({
  detail,
  onDetailCommit,
  editable,
  ref,
}: {
  detail: string;
  onDetailCommit: (next: string) => void;
  editable: boolean;
  ref?: RefObject<HTMLParagraphElement | null>;
}) {
  const innerRef = useRef<HTMLParagraphElement | null>(null);
  const focusedRef = useRef(false);

  const setRefs = useCallback(
    (node: HTMLParagraphElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as MutableRefObject<HTMLParagraphElement | null>).current = node;
      }
    },
    [ref]
  );

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el || focusedRef.current) {
      return;
    }
    fillOrdoV7SingleLineFieldDOM(el, detail);
  }, [detail]);

  return (
    <p
      className={cardStyles.locOrdoV7DetailLine}
      contentEditable={editable}
      data-hg-lore-location-field="detail"
      data-placeholder="Ward · material · micro-context"
      onBeforeInput={(e) => {
        if (!editable) {
          return;
        }
        const native = e.nativeEvent;
        if (!(native instanceof InputEvent)) {
          return;
        }
        if (
          shouldBlockLocationTopFieldBeforeInput(
            "detail",
            e.currentTarget,
            native
          )
        ) {
          e.preventDefault();
        }
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        onDetailCommit(e.currentTarget.innerText.replace(/\s+/g, " ").trim());
      }}
      onDrop={(e) => {
        if (!editable) {
          return;
        }
        handleTopFieldDrop(e);
      }}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onPaste={(e) => {
        if (!editable) {
          return;
        }
        handleTopFieldPaste("detail", e);
      }}
      ref={setRefs}
      suppressContentEditableWarning
    />
  );
});
DetailLine.displayName = "DetailLine";

export interface LoreLocationOrdoV7SlabProps {
  bodyHtml: string;
  editable: boolean;
  emptyPlaceholder?: string | null;
  /** Lab: stable hashed staple tilt. */
  labTestId?: string;
  nodeId: string;
  onCommit: (html: string) => void;
  onDraftDirty?: (dirty: boolean) => void;
  /** Canvas: hide staple when grouped (stacked). Lab defaults to true. */
  showStaple?: boolean;
  /** Canvas: degrees match `entity.tapeRotation` (set on parent for staple CSS var). */
  tapeRotationDeg?: number;
}

/**
 * Canonical ORDO location v7 slab — shared by infinite canvas and lore entity lab (same DOM + `buildLocationOrdoV7BodyHtml`).
 */
export function LoreLocationOrdoV7Slab({
  nodeId,
  bodyHtml,
  showStaple = true,
  tapeRotationDeg,
  labTestId,
  editable,
  onCommit,
  onDraftDirty,
  emptyPlaceholder,
}: LoreLocationOrdoV7SlabProps) {
  const parsed = useMemo(
    () => parseLocationOrdoV7BodyPlainFields(bodyHtml),
    [bodyHtml]
  );

  const [name, setName] = useState(parsed.name);
  const [context, setContext] = useState(parsed.context);
  const [detail, setDetail] = useState(parsed.detail);
  const [detailSlotOpen, setDetailSlotOpen] = useState(false);
  const detailLineRef = useRef<HTMLParagraphElement | null>(null);

  const [notesDoc, setNotesDoc] = useState<JSONContent>(() =>
    htmlFragmentToHgDocDoc(parsed.notesHtml)
  );
  const [notesSlotOpen, setNotesSlotOpen] = useState(false);
  const notesSurfaceKey = `loc-ordo-v7-notes-${nodeId}`;
  const notesEmpty = useMemo(() => isNotesHgDocEmpty(notesDoc), [notesDoc]);

  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushed = useRef(bodyHtml);
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) {
      return;
    }
    const removeCaret = installLoreV11PlaceholderCaretSync(el);
    const removeGuards = installLorePlaceholderSelectionGuards(el);
    return () => {
      removeCaret();
      removeGuards();
    };
  }, []);

  useLayoutEffect(() => {
    syncLoreV11MarkerTilts(rootRef.current);
    syncLoreV11PhCaretOffsetsInHost(rootRef.current);
  }, []);

  /* Sync local fields when `bodyHtml` changes from outside this editor (reload, collab, parent reset). */
  /* eslint-disable react-hooks/set-state-in-effect -- intentional prop→state sync; not a cascading-render loop */
  useEffect(() => {
    if (bodyHtml === lastPushed.current) {
      return;
    }
    lastPushed.current = bodyHtml;
    const p = parseLocationOrdoV7BodyPlainFields(bodyHtml);
    setName(p.name);
    setContext(p.context);
    setDetail(p.detail);
    setNotesDoc(htmlFragmentToHgDocDoc(p.notesHtml));
  }, [bodyHtml]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const pushHtml = useCallback(
    (p: {
      name: string;
      context: string;
      detail: string;
      notesHtml: string;
    }) => {
      const html = buildLocationOrdoV7BodyHtml({
        context: p.context,
        detail: p.detail,
        name: p.name,
        notesInnerHtml: p.notesHtml,
      });
      lastPushed.current = html;
      onCommit(html);
      onDraftDirty?.(false);
    },
    [onCommit, onDraftDirty]
  );

  const scheduleNotesCommit = useCallback(
    (nextDoc: JSONContent) => {
      onDraftDirty?.(true);
      if (notesTimer.current) {
        clearTimeout(notesTimer.current);
      }
      notesTimer.current = setTimeout(() => {
        notesTimer.current = null;
        pushHtml({
          context,
          detail,
          name,
          notesHtml: hgDocToHtml(nextDoc),
        });
      }, 320);
    },
    [name, context, detail, onDraftDirty, pushHtml]
  );

  useEffect(
    () => () => {
      if (notesTimer.current) {
        clearTimeout(notesTimer.current);
      }
    },
    []
  );

  useLayoutEffect(() => {
    if (!detailSlotOpen || detail.trim().length > 0) {
      return;
    }
    detailLineRef.current?.focus();
  }, [detailSlotOpen, detail]);

  /* Focus the notes editor once it mounts in response to "add notes" so the caret is ready. */
  useLayoutEffect(() => {
    if (!(notesSlotOpen && notesEmpty)) {
      return;
    }
    getHgDocEditor(notesSurfaceKey)?.focus();
  }, [notesSlotOpen, notesEmpty, notesSurfaceKey]);

  const showDetailLine = detail.trim().length > 0 || detailSlotOpen;
  const showNotesEditor = !notesEmpty || notesSlotOpen;

  return (
    <div
      className={cardStyles.locOrdoV7Root}
      data-hg-canvas-role="lore-location"
      data-hg-lore-location-variant="v7"
      data-hg-lore-ordo-node-id={nodeId}
      data-testid={labTestId}
      ref={rootRef}
    >
      <div aria-hidden className={cardStyles.locOrdoV7Geo} />
      <div aria-hidden className={cardStyles.locOrdoV7Glow} />
      {showStaple ? (
        <OrdoV7Staple
          labTestId={labTestId}
          nodeId={nodeId}
          tapeRotationDeg={tapeRotationDeg}
        />
      ) : null}
      <div className={cardStyles.locOrdoV7Inner}>
        <header
          className={cardStyles.locOrdoV7Header}
          data-hg-lore-ordo-drag-handle="true"
        >
          <div className={cardStyles.locOrdoV7LogoBlock}>
            <div aria-hidden className={cardStyles.locOrdoV7PixelIcon}>
              {ORDO_V7_LOGO_PIXEL_GRID.map((row, ri) =>
                row.map((on, ci) => (
                  <span
                    className={cx(
                      cardStyles.locOrdoV7Px,
                      !on && cardStyles.locOrdoV7PxOff
                    )}
                    key={`${ri}-${ci}`}
                  />
                ))
              )}
            </div>
          </div>
          <div>
            <ArchitecturalTooltip
              content="Expand object"
              delayMs={320}
              side="bottom"
            >
              <Button
                aria-label="Expand object"
                className={cardStyles.locOrdoV7ExpandBtn}
                data-expand-btn="true"
                onClick={() => {}}
                size="icon"
                tone="card-light"
                type="button"
                variant="ghost"
              >
                <ArrowsOutSimple size={14} />
              </Button>
            </ArchitecturalTooltip>
          </div>
        </header>

        <div className={cardStyles.locOrdoV7DocGrid}>
          <TitleAndContext
            context={context}
            editable={editable}
            name={name}
            onContextCommit={(next) => {
              setContext(next);
              pushHtml({
                context: next,
                detail,
                name,
                notesHtml: hgDocToHtml(notesDoc),
              });
            }}
            onContextDraftChange={setContext}
            onNameCommit={(next) => {
              setName(next);
              pushHtml({
                context,
                detail,
                name: next,
                notesHtml: hgDocToHtml(notesDoc),
              });
            }}
            onNameDraftChange={setName}
          />

          <div className={cardStyles.locOrdoV7Main}>
            <div
              className={cx(
                cardStyles.locOrdoV7ContentBlock,
                cardStyles.locOrdoV7DocInline
              )}
            >
              {showDetailLine ? (
                <DetailLine
                  detail={detail}
                  editable={editable}
                  onDetailCommit={(next) => {
                    setDetail(next);
                    if (!next.trim()) {
                      setDetailSlotOpen(false);
                    }
                    pushHtml({
                      context,
                      detail: next,
                      name,
                      notesHtml: hgDocToHtml(notesDoc),
                    });
                  }}
                  ref={detailLineRef}
                />
              ) : (
                // eslint-disable-next-line no-restricted-syntax -- ORDO v7 detail slot: native slab row (lab parity; not vigil-btn)
                <button
                  aria-label="Add site detail line"
                  className={cardStyles.locOrdoV7DetailAdd}
                  data-hg-lore-location-detail-add="true"
                  onClick={() => {
                    setDetail("");
                    setDetailSlotOpen(true);
                  }}
                  type="button"
                >
                  {"// add site detail"}
                </button>
              )}
              {showNotesEditor ? (
                <div
                  className={cardStyles.locOrdoV7NotesCell}
                  contentEditable={false}
                  data-hg-lore-location-notes-cell="true"
                  onBlur={(e) => {
                    /* Collapse back to the "+ add notes" row once focus leaves the cell with empty content. */
                    if (!editable) {
                      return;
                    }
                    if (
                      e.currentTarget.contains(e.relatedTarget as Node | null)
                    ) {
                      return;
                    }
                    if (!notesEmpty) {
                      return;
                    }
                    setNotesSlotOpen(false);
                  }}
                >
                  <div
                    className={cardStyles.locOrdoV7NotesField}
                    contentEditable={false}
                    data-hg-lore-location-notes="true"
                  >
                    <HeartgardenDocEditor
                      chromeRole="canvas"
                      className={cardStyles.locOrdoV7HgHost}
                      editable={editable}
                      onChange={(next) => {
                        setNotesDoc(next);
                        scheduleNotesCommit(next);
                      }}
                      placeholder={
                        emptyPlaceholder ?? "Notes… type / for blocks"
                      }
                      showAiPendingGutter={false}
                      surfaceKey={notesSurfaceKey}
                      value={notesDoc}
                    />
                  </div>
                </div>
              ) : editable ? (
                // eslint-disable-next-line no-restricted-syntax -- ORDO v7 notes slot: native slab row (parity with detail add)
                <button
                  aria-label="Add site notes"
                  className={cardStyles.locOrdoV7NotesAdd}
                  data-hg-lore-location-notes-add="true"
                  onClick={() => setNotesSlotOpen(true)}
                  type="button"
                >
                  {"// add notes"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
