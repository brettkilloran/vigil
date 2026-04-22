"use client";

import type { JSONContent } from "@tiptap/core";
import { startTransition, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { HeartgardenDocEditor } from "@/src/components/editing/HeartgardenDocEditor";
import { Button } from "@/src/components/ui/Button";
import {
  buildCharacterFocusDocumentHtml,
  extractCharacterIdentityRowHtml,
  parseCharacterFocusDocumentHtml,
  readCharacterFocusPartsFromIdentityRow,
  type CharacterFocusParts,
} from "@/src/lib/lore-character-focus-document-html";
import {
  buildFactionFocusDocumentHtml,
  buildFactionFocusMetaShellHtml,
  extractFactionMetaFocusShellHtml,
  parseFactionFocusDocumentHtml,
  readFactionFocusPartsFromMetaHost,
  type FactionFocusParts,
} from "@/src/lib/lore-faction-focus-document-html";
import {
  buildLocationFocusDocumentHtml,
  computeLocationTopFieldPasteInsertText,
  buildLocationFocusMetaShellHtml,
  extractLocationMetaFocusShellHtml,
  insertPlainTextIntoContentEditable,
  parseLocationFocusDocumentHtml,
  readLocationFocusPartsFromMetaHost,
  shouldBlockLocationTopFieldBeforeInput,
  type LocationFocusParts,
} from "@/src/lib/lore-location-focus-document-html";
import { EMPTY_HG_DOC } from "@/src/lib/hg-doc/constants";
import { hgDocToHtml } from "@/src/lib/hg-doc/html-export";
import { htmlFragmentToHgDocDoc } from "@/src/lib/hg-doc/html-to-doc";
import type { FactionRosterEntry } from "@/src/lib/faction-roster-schema";

import styles from "@/src/components/editing/LoreHybridFocusEditor.module.css";

function docJsonKey(doc: JSONContent): string {
  try {
    return JSON.stringify(doc);
  } catch {
    return "";
  }
}

function eventTargetElement(ev: Event): Element | null {
  const t = ev.target;
  if (t instanceof Element) return t;
  if (t instanceof Text && t.parentElement) return t.parentElement;
  return null;
}

function locationTopFieldFromEl(el: Element | null): "name" | "context" | "detail" | null {
  if (!el) return null;
  const host = el.closest("[data-hg-lore-location-focus-field]");
  if (!(host instanceof HTMLElement)) return null;
  const field = host.getAttribute("data-hg-lore-location-focus-field");
  if (field === "name" || field === "context" || field === "detail") return field;
  return null;
}

export type LoreHybridFocusEditorProps = {
  variant: "character" | "location" | "faction";
  focusHtml: string;
  onChangeFocusHtml: (next: string) => void;
  factionRoster?: FactionRosterEntry[];
  onFactionRosterChange?: (next: FactionRosterEntry[]) => void;
  className?: string;
  notesSurfaceKey?: string;
  /** When this changes (e.g. active node id), identity row HTML is re-injected once; same key avoids wiping contenteditable while typing. */
  focusDocumentKey?: string | null;
};

export function LoreHybridFocusEditor({
  variant,
  focusHtml,
  onChangeFocusHtml,
  factionRoster,
  onFactionRosterChange,
  className,
  notesSurfaceKey = "focus-lore-notes",
  focusDocumentKey = null,
}: LoreHybridFocusEditorProps) {
  const [characterParts, setCharacterParts] = useState<CharacterFocusParts | null>(null);
  const [locationParts, setLocationParts] = useState<LocationFocusParts | null>(null);
  const [factionParts, setFactionParts] = useState<FactionFocusParts | null>(null);
  const [notesDoc, setNotesDoc] = useState<JSONContent>(() => structuredClone(EMPTY_HG_DOC));
  const characterPartsRef = useRef<CharacterFocusParts | null>(null);
  const locationPartsRef = useRef<LocationFocusParts | null>(null);
  const factionPartsRef = useRef<FactionFocusParts | null>(null);
  const notesDocRef = useRef(notesDoc);
  const notesDocKeyRef = useRef(docJsonKey(notesDoc));
  const identityShellRef = useRef<HTMLDivElement | null>(null);
  const locationMetaShellRef = useRef<HTMLDivElement | null>(null);
  const factionMetaShellRef = useRef<HTMLDivElement | null>(null);
  const lastInjectedIdentityDocKeyRef = useRef<string | null>(null);
  const lastInjectedLocationMetaDocKeyRef = useRef<string | null>(null);
  const lastInjectedFactionMetaDocKeyRef = useRef<string | null>(null);
  /** Dedupes `onChangeFocusHtml` when rebuild matches current parent `focusHtml`. */
  const lastEmittedFocusHtmlRef = useRef<string | null>(null);
  /** When notes emit updates `focusHtml`, re-parsing in the sync effect must not push `notesDoc` back through TipTap or `setContent` clears focus after each key. */
  const skipNotesResyncFromFocusHtmlRef = useRef(0);

  useEffect(() => {
    notesDocRef.current = notesDoc;
    notesDocKeyRef.current = docJsonKey(notesDoc);
  }, [notesDoc]);
  useEffect(() => {
    characterPartsRef.current = characterParts;
  }, [characterParts]);
  useEffect(() => {
    locationPartsRef.current = locationParts;
  }, [locationParts]);
  useEffect(() => {
    factionPartsRef.current = factionParts;
  }, [factionParts]);

  useEffect(() => {
    lastEmittedFocusHtmlRef.current = focusHtml;
  }, [focusHtml]);

  useEffect(() => {
    startTransition(() => {
      if (variant === "character") {
        const p = parseCharacterFocusDocumentHtml(focusHtml);
        if (p) {
          setCharacterParts(p);
          if (skipNotesResyncFromFocusHtmlRef.current > 0) {
            skipNotesResyncFromFocusHtmlRef.current = 0;
          } else {
            const nextNotes = htmlFragmentToHgDocDoc(p.notesHtml);
            const nextNotesKey = docJsonKey(nextNotes);
            if (notesDocKeyRef.current !== nextNotesKey) {
              setNotesDoc(nextNotes);
            }
          }
        } else {
          setCharacterParts(null);
        }
      } else if (variant === "location") {
        const lp = parseLocationFocusDocumentHtml(focusHtml);
        if (lp) {
          setLocationParts(lp);
          if (skipNotesResyncFromFocusHtmlRef.current > 0) {
            skipNotesResyncFromFocusHtmlRef.current = 0;
          } else {
            const nextNotes = htmlFragmentToHgDocDoc(lp.notesHtml);
            const nextNotesKey = docJsonKey(nextNotes);
            if (notesDocKeyRef.current !== nextNotesKey) {
              setNotesDoc(nextNotes);
            }
          }
        } else {
          setLocationParts(null);
        }
      } else {
        const fp = parseFactionFocusDocumentHtml(focusHtml);
        if (fp) {
          setFactionParts(fp);
          if (skipNotesResyncFromFocusHtmlRef.current > 0) {
            skipNotesResyncFromFocusHtmlRef.current = 0;
          } else {
            const nextRecord = htmlFragmentToHgDocDoc(fp.recordHtml);
            const nextRecordKey = docJsonKey(nextRecord);
            if (notesDocKeyRef.current !== nextRecordKey) {
              setNotesDoc(nextRecord);
            }
          }
        } else {
          setFactionParts(null);
        }
      }
    });
  }, [variant, focusHtml]);

  useLayoutEffect(() => {
    if (variant !== "character") {
      lastInjectedIdentityDocKeyRef.current = null;
      return;
    }
    if (!characterParts) {
      lastInjectedIdentityDocKeyRef.current = null;
      return;
    }
    const host = identityShellRef.current;
    if (!host) return;
    const k = focusDocumentKey ?? "";
    if (lastInjectedIdentityDocKeyRef.current != null && lastInjectedIdentityDocKeyRef.current === k) {
      return;
    }
    lastInjectedIdentityDocKeyRef.current = k;
    const rowHtml = extractCharacterIdentityRowHtml(focusHtml);
    if (rowHtml) host.innerHTML = rowHtml;
  }, [variant, characterParts, focusDocumentKey, focusHtml]);

  useLayoutEffect(() => {
    if (variant !== "faction") {
      lastInjectedFactionMetaDocKeyRef.current = null;
      return;
    }
    if (!factionParts) {
      lastInjectedFactionMetaDocKeyRef.current = null;
      return;
    }
    const host = factionMetaShellRef.current;
    if (!host) return;
    const k = focusDocumentKey ?? "";
    if (lastInjectedFactionMetaDocKeyRef.current != null && lastInjectedFactionMetaDocKeyRef.current === k) {
      return;
    }
    lastInjectedFactionMetaDocKeyRef.current = k;
    const shellHtml =
      extractFactionMetaFocusShellHtml(focusHtml) || buildFactionFocusMetaShellHtml(factionParts);
    if (shellHtml) host.innerHTML = shellHtml;
  }, [variant, factionParts, focusDocumentKey, focusHtml]);

  useLayoutEffect(() => {
    if (variant !== "location") {
      lastInjectedLocationMetaDocKeyRef.current = null;
      return;
    }
    if (!locationParts) {
      lastInjectedLocationMetaDocKeyRef.current = null;
      return;
    }
    const host = locationMetaShellRef.current;
    if (!host) return;
    const k = focusDocumentKey ?? "";
    if (lastInjectedLocationMetaDocKeyRef.current != null && lastInjectedLocationMetaDocKeyRef.current === k) {
      return;
    }
    lastInjectedLocationMetaDocKeyRef.current = k;
    const shellHtml =
      extractLocationMetaFocusShellHtml(focusHtml) || buildLocationFocusMetaShellHtml(locationParts);
    if (shellHtml) host.innerHTML = shellHtml;
  }, [variant, locationParts, focusDocumentKey, focusHtml]);

  const emitCharacter = useCallback(
    (nextParts: CharacterFocusParts, doc: JSONContent) => {
      const notesHtml = hgDocToHtml(doc);
      const nextHtml = buildCharacterFocusDocumentHtml({ ...nextParts, notesHtml });
      if (lastEmittedFocusHtmlRef.current === nextHtml) return;
      lastEmittedFocusHtmlRef.current = nextHtml;
      onChangeFocusHtml(nextHtml);
    },
    [onChangeFocusHtml],
  );

  const emitLocation = useCallback(
    (nextParts: LocationFocusParts, doc: JSONContent) => {
      const notesHtml = hgDocToHtml(doc);
      const nextHtml = buildLocationFocusDocumentHtml({ ...nextParts, notesHtml });
      if (lastEmittedFocusHtmlRef.current === nextHtml) return;
      lastEmittedFocusHtmlRef.current = nextHtml;
      onChangeFocusHtml(nextHtml);
    },
    [onChangeFocusHtml],
  );

  const emitFaction = useCallback(
    (nextParts: FactionFocusParts, doc: JSONContent) => {
      const recordHtml = hgDocToHtml(doc);
      const nextHtml = buildFactionFocusDocumentHtml({ ...nextParts, recordHtml });
      if (lastEmittedFocusHtmlRef.current === nextHtml) return;
      lastEmittedFocusHtmlRef.current = nextHtml;
      onChangeFocusHtml(nextHtml);
    },
    [onChangeFocusHtml],
  );

  const hasCharacterShell = characterParts != null;
  const hasLocationShell = locationParts != null;
  const hasFactionShell = factionParts != null;
  const canEditFactionRoster = variant === "faction" && typeof onFactionRosterChange === "function";

  useEffect(() => {
    if (variant !== "character" || !hasCharacterShell) return;
    const host = identityShellRef.current;
    if (!host) return;

    const flushFromIdentityDom = () => {
      const row = host.querySelector<HTMLElement>('[data-hg-character-focus-row="identity"]');
      if (!row) return;
      const next = readCharacterFocusPartsFromIdentityRow(row, hgDocToHtml(notesDocRef.current));
      setCharacterParts(next);
      characterPartsRef.current = next;
      emitCharacter(next, notesDocRef.current);
    };

    const onMaybeIdentityEdit = (ev: Event) => {
      const el = eventTargetElement(ev);
      if (!el?.closest("[data-hg-character-focus-field]")) return;
      flushFromIdentityDom();
    };

    host.addEventListener("input", onMaybeIdentityEdit, true);
    host.addEventListener("compositionend", onMaybeIdentityEdit, true);
    return () => {
      host.removeEventListener("input", onMaybeIdentityEdit, true);
      host.removeEventListener("compositionend", onMaybeIdentityEdit, true);
    };
  }, [variant, hasCharacterShell, emitCharacter, focusDocumentKey]);

  useEffect(() => {
    if (variant !== "location" || !hasLocationShell) return;
    const host = locationMetaShellRef.current;
    if (!host) return;

    const flushFromMetaDom = () => {
      const meta = host.querySelector<HTMLElement>('[data-hg-lore-location-focus-meta="true"]');
      if (!meta) return;
      const next = readLocationFocusPartsFromMetaHost(meta, hgDocToHtml(notesDocRef.current));
      setLocationParts(next);
      locationPartsRef.current = next;
      emitLocation(next, notesDocRef.current);
    };

    const onMaybeMetaEdit = (ev: Event) => {
      const el = eventTargetElement(ev);
      if (!el?.closest("[data-hg-lore-location-focus-field]")) return;
      flushFromMetaDom();
    };

    const onBeforeInput = (ev: Event) => {
      if (!(ev instanceof InputEvent)) return;
      const el = eventTargetElement(ev);
      const field = locationTopFieldFromEl(el);
      if (!field) return;
      const fieldEl = el?.closest("[data-hg-lore-location-focus-field]");
      if (!(fieldEl instanceof HTMLElement)) return;
      if (shouldBlockLocationTopFieldBeforeInput(field, fieldEl, ev)) {
        ev.preventDefault();
      }
    };

    const onPaste = (ev: Event) => {
      if (!(ev instanceof ClipboardEvent)) return;
      const el = eventTargetElement(ev);
      const field = locationTopFieldFromEl(el);
      if (!field) return;
      const fieldEl = el?.closest("[data-hg-lore-location-focus-field]");
      if (!(fieldEl instanceof HTMLElement)) return;
      const clipped = computeLocationTopFieldPasteInsertText(
        field,
        fieldEl,
        ev.clipboardData?.getData("text/plain") ?? "",
      );
      ev.preventDefault();
      if (!clipped) return;
      insertPlainTextIntoContentEditable(fieldEl, clipped);
    };

    const onDrop = (ev: Event) => {
      const el = eventTargetElement(ev);
      const field = locationTopFieldFromEl(el);
      if (!field) return;
      ev.preventDefault();
    };

    host.addEventListener("beforeinput", onBeforeInput, true);
    host.addEventListener("paste", onPaste, true);
    host.addEventListener("drop", onDrop, true);
    host.addEventListener("input", onMaybeMetaEdit, true);
    host.addEventListener("compositionend", onMaybeMetaEdit, true);
    return () => {
      host.removeEventListener("beforeinput", onBeforeInput, true);
      host.removeEventListener("paste", onPaste, true);
      host.removeEventListener("drop", onDrop, true);
      host.removeEventListener("input", onMaybeMetaEdit, true);
      host.removeEventListener("compositionend", onMaybeMetaEdit, true);
    };
  }, [variant, hasLocationShell, emitLocation, focusDocumentKey]);

  useEffect(() => {
    if (variant !== "faction" || !hasFactionShell) return;
    const host = factionMetaShellRef.current;
    if (!host) return;

    const flushFromMetaDom = () => {
      const meta = host.querySelector<HTMLElement>('[data-hg-faction-focus-meta="true"]');
      if (!meta) return;
      const next = readFactionFocusPartsFromMetaHost(meta, hgDocToHtml(notesDocRef.current));
      setFactionParts(next);
      factionPartsRef.current = next;
      emitFaction(next, notesDocRef.current);
    };

    const onMaybeMetaEdit = (ev: Event) => {
      const el = eventTargetElement(ev);
      if (!el?.closest("[data-hg-faction-focus-field]")) return;
      flushFromMetaDom();
    };

    host.addEventListener("input", onMaybeMetaEdit, true);
    host.addEventListener("compositionend", onMaybeMetaEdit, true);
    return () => {
      host.removeEventListener("input", onMaybeMetaEdit, true);
      host.removeEventListener("compositionend", onMaybeMetaEdit, true);
    };
  }, [variant, hasFactionShell, emitFaction, focusDocumentKey]);

  const onNotesChange = useCallback(
    (doc: JSONContent) => {
      setNotesDoc(doc);
      skipNotesResyncFromFocusHtmlRef.current += 1;
      if (variant === "character") {
        const p = characterPartsRef.current;
        if (p) emitCharacter(p, doc);
      } else if (variant === "location") {
        const lp = locationPartsRef.current;
        if (lp) emitLocation(lp, doc);
      } else {
        const fp = factionPartsRef.current;
        if (fp) emitFaction(fp, doc);
      }
    },
    [variant, emitCharacter, emitLocation, emitFaction],
  );

  const createRosterRowId = useCallback(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `hg-roster-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  }, []);

  const addFocusFactionRosterRow = useCallback(() => {
    if (!onFactionRosterChange) return;
    const nextRoster = factionRoster ?? [];
    onFactionRosterChange([
      ...nextRoster,
      {
        id: createRosterRowId(),
        kind: "unlinked",
        label: "New member",
      },
    ]);
  }, [createRosterRowId, factionRoster, onFactionRosterChange]);

  const removeFocusFactionRosterRow = useCallback(
    (rowId: string) => {
      if (!onFactionRosterChange) return;
      const nextRoster = factionRoster ?? [];
      onFactionRosterChange(nextRoster.filter((row) => row.id !== rowId));
    },
    [factionRoster, onFactionRosterChange],
  );

  if (variant === "character" && !characterParts) {
    return <div className={className} data-focus-body-editor="true" />;
  }
  if (variant === "location" && !locationParts) {
    return <div className={className} data-focus-body-editor="true" />;
  }
  if (variant === "faction" && !factionParts) {
    return <div className={className} data-focus-body-editor="true" />;
  }

  if (variant === "character" && characterParts) {
    return (
      <div
        className={`${styles.host} ${className ?? ""}`.trim()}
        data-focus-body-editor="true"
        data-hg-lore-hybrid-focus="character"
      >
        {/* Portrait + meta fields: HTML injected in useLayoutEffect when `focusDocumentKey` changes (grid layout from global CSS). */}
        <div ref={identityShellRef} className={styles.portraitHost} />
        <div className={styles.notesWrap} data-hg-lore-hybrid-notes-wrap="true">
          <span className={styles.label} data-hg-lore-hybrid-notes-label="true">
            Notes
          </span>
          <HeartgardenDocEditor
            surfaceKey={notesSurfaceKey}
            chromeRole="focus"
            value={notesDoc}
            onChange={onNotesChange}
            editable
            placeholder="Write here, or type / for blocks…"
            enableDragHandle
          />
        </div>
      </div>
    );
  }

  if (variant === "faction" && factionParts) {
    return (
      <div
        className={`${styles.host} ${className ?? ""}`.trim()}
        data-focus-body-editor="true"
        data-hg-lore-hybrid-focus="faction"
      >
        <div ref={factionMetaShellRef} className={styles.factionMetaHost} />
        <div className={styles.factionRosterWrap} data-hg-faction-focus-roster="true">
          <div className={styles.factionRosterHeader}>
            <span className={styles.label}>Member index</span>
            <div className={styles.factionRosterHeaderActions}>
              <span className={styles.factionRosterCount}>
                {(factionRoster ?? []).length} record{(factionRoster ?? []).length === 1 ? "" : "s"}
              </span>
              {canEditFactionRoster ? (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  tone="focus-dark"
                  className={styles.factionRosterActionBtn}
                  aria-label="Add faction member"
                  onClick={addFocusFactionRosterRow}
                >
                  Add
                </Button>
              ) : null}
            </div>
          </div>
          <div className={styles.factionRosterList}>
            {(factionRoster ?? []).length === 0 ? (
              <p className={styles.factionRosterEmpty}>No known members.</p>
            ) : (
              (factionRoster ?? []).map((row) => {
                const primary =
                  row.kind === "character"
                    ? row.displayNameOverride?.trim() || `Character ${row.characterItemId.slice(0, 8)}…`
                    : row.label.trim() || "Member";
                const secondary =
                  row.kind === "character"
                    ? row.roleOverride?.trim() || null
                    : row.role?.trim() || null;
                return (
                  <div key={row.id} className={styles.factionRosterRow}>
                    <div className={styles.factionRosterRowMain}>
                      <p className={styles.factionRosterRowPrimary}>{primary}</p>
                      {secondary ? (
                        <p className={styles.factionRosterRowSecondary}>{secondary}</p>
                      ) : null}
                    </div>
                    {canEditFactionRoster ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        tone="focus-dark"
                        className={styles.factionRosterActionBtn}
                        aria-label={`Delete ${primary}`}
                        onClick={() => removeFocusFactionRosterRow(row.id)}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className={styles.notesWrap} data-hg-lore-hybrid-notes-wrap="true">
          <span className={styles.label} data-hg-lore-hybrid-notes-label="true">
            Record
          </span>
          <HeartgardenDocEditor
            surfaceKey={notesSurfaceKey}
            chromeRole="focus"
            value={notesDoc}
            onChange={onNotesChange}
            editable
            placeholder="Write here, or type / for blocks…"
            enableDragHandle
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.host} ${className ?? ""}`.trim()}
      data-focus-body-editor="true"
      data-hg-lore-hybrid-focus="location"
    >
      {/* Structured fields: HTML injected when `focusDocumentKey` changes — layout from `ArchitecturalCanvasApp` (`.focusLocationDocument`). */}
      <div ref={locationMetaShellRef} className={styles.locationMetaHost} />
      <div className={styles.notesWrap} data-hg-lore-hybrid-notes-wrap="true">
        <span className={styles.label} data-hg-lore-hybrid-notes-label="true">
          Notes
        </span>
        <HeartgardenDocEditor
          surfaceKey={notesSurfaceKey}
          chromeRole="focus"
          value={notesDoc}
          onChange={onNotesChange}
          editable
          placeholder="Write here, or type / for blocks…"
          enableDragHandle
        />
      </div>
    </div>
  );
}
