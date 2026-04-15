"use client";

import type { JSONContent } from "@tiptap/core";
import { startTransition, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { HeartgardenDocEditor } from "@/src/components/editing/HeartgardenDocEditor";
import {
  buildCharacterFocusDocumentHtml,
  extractCharacterIdentityRowHtml,
  parseCharacterFocusDocumentHtml,
  readCharacterFocusPartsFromIdentityRow,
  type CharacterFocusParts,
} from "@/src/lib/lore-character-focus-document-html";
import {
  buildLocationFocusDocumentHtml,
  buildLocationFocusMetaShellHtml,
  extractLocationMetaFocusShellHtml,
  parseLocationFocusDocumentHtml,
  readLocationFocusPartsFromMetaHost,
  type LocationFocusParts,
} from "@/src/lib/lore-location-focus-document-html";
import { EMPTY_HG_DOC } from "@/src/lib/hg-doc/constants";
import { hgDocToHtml } from "@/src/lib/hg-doc/html-export";
import { htmlFragmentToHgDocDoc } from "@/src/lib/hg-doc/html-to-doc";

import styles from "@/src/components/editing/LoreHybridFocusEditor.module.css";

function eventTargetElement(ev: Event): Element | null {
  const t = ev.target;
  if (t instanceof Element) return t;
  if (t instanceof Text && t.parentElement) return t.parentElement;
  return null;
}

export type LoreHybridFocusEditorProps = {
  variant: "character" | "location";
  focusHtml: string;
  onChangeFocusHtml: (next: string) => void;
  className?: string;
  notesSurfaceKey?: string;
  /** When this changes (e.g. active node id), identity row HTML is re-injected once; same key avoids wiping contenteditable while typing. */
  focusDocumentKey?: string | null;
};

export function LoreHybridFocusEditor({
  variant,
  focusHtml,
  onChangeFocusHtml,
  className,
  notesSurfaceKey = "focus-lore-notes",
  focusDocumentKey = null,
}: LoreHybridFocusEditorProps) {
  const [characterParts, setCharacterParts] = useState<CharacterFocusParts | null>(null);
  const [locationParts, setLocationParts] = useState<LocationFocusParts | null>(null);
  const [notesDoc, setNotesDoc] = useState<JSONContent>(() => structuredClone(EMPTY_HG_DOC));
  const characterPartsRef = useRef<CharacterFocusParts | null>(null);
  const locationPartsRef = useRef<LocationFocusParts | null>(null);
  const notesDocRef = useRef(notesDoc);
  const identityShellRef = useRef<HTMLDivElement | null>(null);
  const locationMetaShellRef = useRef<HTMLDivElement | null>(null);
  const lastInjectedIdentityDocKeyRef = useRef<string | null>(null);
  const lastInjectedLocationMetaDocKeyRef = useRef<string | null>(null);
  /** Dedupes `onChangeFocusHtml` when rebuild matches current parent `focusHtml`. */
  const lastEmittedFocusHtmlRef = useRef<string | null>(null);
  /** When notes emit updates `focusHtml`, re-parsing in the sync effect must not push `notesDoc` back through TipTap or `setContent` clears focus after each key. */
  const skipNotesResyncFromFocusHtmlRef = useRef(0);

  useEffect(() => {
    notesDocRef.current = notesDoc;
  }, [notesDoc]);
  useEffect(() => {
    characterPartsRef.current = characterParts;
  }, [characterParts]);
  useEffect(() => {
    locationPartsRef.current = locationParts;
  }, [locationParts]);

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
            if (JSON.stringify(notesDocRef.current) !== JSON.stringify(nextNotes)) {
              setNotesDoc(nextNotes);
            }
          }
        } else {
          setCharacterParts(null);
        }
      } else {
        const lp = parseLocationFocusDocumentHtml(focusHtml);
        if (lp) {
          setLocationParts(lp);
          if (skipNotesResyncFromFocusHtmlRef.current > 0) {
            skipNotesResyncFromFocusHtmlRef.current = 0;
          } else {
            const nextNotes = htmlFragmentToHgDocDoc(lp.notesHtml);
            if (JSON.stringify(notesDocRef.current) !== JSON.stringify(nextNotes)) {
              setNotesDoc(nextNotes);
            }
          }
        } else {
          setLocationParts(null);
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

  const hasCharacterShell = characterParts != null;
  const hasLocationShell = locationParts != null;

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

    host.addEventListener("input", onMaybeMetaEdit, true);
    host.addEventListener("compositionend", onMaybeMetaEdit, true);
    return () => {
      host.removeEventListener("input", onMaybeMetaEdit, true);
      host.removeEventListener("compositionend", onMaybeMetaEdit, true);
    };
  }, [variant, hasLocationShell, emitLocation, focusDocumentKey]);

  const onNotesChange = useCallback(
    (doc: JSONContent) => {
      setNotesDoc(doc);
      skipNotesResyncFromFocusHtmlRef.current += 1;
      if (variant === "character") {
        const p = characterPartsRef.current;
        if (p) emitCharacter(p, doc);
      } else {
        const lp = locationPartsRef.current;
        if (lp) emitLocation(lp, doc);
      }
    },
    [variant, emitCharacter, emitLocation],
  );

  if (variant === "character" && !characterParts) {
    return <div className={className} data-focus-body-editor="true" />;
  }
  if (variant === "location" && !locationParts) {
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
        <div className={styles.notesWrap}>
          <span className={styles.label}>Notes</span>
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
      <div className={styles.notesWrap}>
        <span className={styles.label}>Notes</span>
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
