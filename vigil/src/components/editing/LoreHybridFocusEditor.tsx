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
  parseLocationFocusDocumentHtml,
  type LocationFocusParts,
} from "@/src/lib/lore-location-focus-document-html";
import { EMPTY_HG_DOC } from "@/src/lib/hg-doc/constants";
import { hgDocToHtml } from "@/src/lib/hg-doc/html-export";
import { htmlFragmentToHgDocDoc } from "@/src/lib/hg-doc/html-to-doc";

import styles from "@/src/components/editing/LoreHybridFocusEditor.module.css";

function htmlToPlainOneLine(html: string): string {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.textContent ?? "").replace(/\s+/g, " ").trim();
}

function plainToFieldHtml(text: string): string {
  const esc = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return esc ? `<p>${esc}</p>` : "<br>";
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
  const lastInjectedIdentityDocKeyRef = useRef<string | null>(null);
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

  const emitCharacter = useCallback(
    (nextParts: CharacterFocusParts, doc: JSONContent) => {
      const notesHtml = hgDocToHtml(doc);
      onChangeFocusHtml(buildCharacterFocusDocumentHtml({ ...nextParts, notesHtml }));
    },
    [onChangeFocusHtml],
  );

  const emitLocation = useCallback(
    (nextParts: LocationFocusParts, doc: JSONContent) => {
      const notesHtml = hgDocToHtml(doc);
      onChangeFocusHtml(buildLocationFocusDocumentHtml({ ...nextParts, notesHtml }));
    },
    [onChangeFocusHtml],
  );

  useEffect(() => {
    if (variant !== "character") return;
    const host = identityShellRef.current;
    if (!host) return;
    const onInput = (ev: Event) => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      if (!t.closest("[data-hg-character-focus-field]")) return;
      const row = host.querySelector<HTMLElement>('[data-hg-character-focus-row="identity"]');
      if (!row) return;
      const next = readCharacterFocusPartsFromIdentityRow(row, hgDocToHtml(notesDocRef.current));
      setCharacterParts(next);
      characterPartsRef.current = next;
      emitCharacter(next, notesDocRef.current);
    };
    host.addEventListener("input", onInput, true);
    return () => host.removeEventListener("input", onInput, true);
  }, [variant, emitCharacter, focusDocumentKey]);

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

  const lp = locationParts!;
  return (
    <div
      className={`${styles.host} ${className ?? ""}`.trim()}
      data-focus-body-editor="true"
      data-hg-lore-hybrid-focus="location"
    >
      <div className={styles.fieldRow}>
        <span className={styles.label}>Place</span>
        <textarea
          className={styles.textarea}
          rows={2}
          value={htmlToPlainOneLine(lp.name)}
          onChange={(e) => {
            const next = { ...lp, name: plainToFieldHtml(e.target.value) };
            setLocationParts(next);
            emitLocation(next, notesDocRef.current);
          }}
        />
      </div>
      <div className={styles.fieldRow}>
        <span className={styles.label}>Context</span>
        <textarea
          className={styles.textarea}
          rows={2}
          value={htmlToPlainOneLine(lp.context)}
          onChange={(e) => {
            const next = { ...lp, context: plainToFieldHtml(e.target.value) };
            setLocationParts(next);
            emitLocation(next, notesDocRef.current);
          }}
        />
      </div>
      <div className={styles.fieldRow}>
        <span className={styles.label}>Detail</span>
        <textarea
          className={styles.textarea}
          rows={2}
          value={htmlToPlainOneLine(lp.detail)}
          onChange={(e) => {
            const next = { ...lp, detail: plainToFieldHtml(e.target.value) };
            setLocationParts(next);
            emitLocation(next, notesDocRef.current);
          }}
        />
      </div>
      {lp.hasRef ? (
        <div className={styles.fieldRow}>
          <span className={styles.label}>Reference</span>
          <textarea
            className={styles.textarea}
            rows={2}
            value={htmlToPlainOneLine(lp.ref)}
            onChange={(e) => {
              const next = { ...lp, ref: plainToFieldHtml(e.target.value) };
              setLocationParts(next);
              emitLocation(next, notesDocRef.current);
            }}
          />
        </div>
      ) : null}
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
