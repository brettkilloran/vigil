"use client";

import type { JSONContent } from "@tiptap/core";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";

import { HeartgardenDocEditor } from "@/src/components/editing/HeartgardenDocEditor";
import {
  buildCharacterFocusDocumentHtml,
  parseCharacterFocusDocumentHtml,
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

function extractCharacterPortraitRowHtml(html: string): string {
  if (typeof DOMParser === "undefined") return "";
  try {
    const doc = new DOMParser().parseFromString(`<div id="__hg_cf_meta">${html}</div>`, "text/html");
    const root = doc.getElementById("__hg_cf_meta");
    const row = root?.querySelector('[data-hg-character-focus-row="identity"]');
    return row?.outerHTML ?? "";
  } catch {
    return "";
  }
}

export type LoreHybridFocusEditorProps = {
  variant: "character" | "location";
  focusHtml: string;
  onChangeFocusHtml: (next: string) => void;
  className?: string;
  notesSurfaceKey?: string;
};

export function LoreHybridFocusEditor({
  variant,
  focusHtml,
  onChangeFocusHtml,
  className,
  notesSurfaceKey = "focus-lore-notes",
}: LoreHybridFocusEditorProps) {
  const [characterParts, setCharacterParts] = useState<CharacterFocusParts | null>(null);
  const [locationParts, setLocationParts] = useState<LocationFocusParts | null>(null);
  const [notesDoc, setNotesDoc] = useState<JSONContent>(() => structuredClone(EMPTY_HG_DOC));
  const characterPartsRef = useRef<CharacterFocusParts | null>(null);
  const locationPartsRef = useRef<LocationFocusParts | null>(null);
  const notesDocRef = useRef(notesDoc);

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
          setNotesDoc(htmlFragmentToHgDocDoc(p.notesHtml));
        } else {
          setCharacterParts(null);
        }
      } else {
        const lp = parseLocationFocusDocumentHtml(focusHtml);
        if (lp) {
          setLocationParts(lp);
          setNotesDoc(htmlFragmentToHgDocDoc(lp.notesHtml));
        } else {
          setLocationParts(null);
        }
      }
    });
  }, [variant, focusHtml]);

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

  const onNotesChange = useCallback(
    (doc: JSONContent) => {
      setNotesDoc(doc);
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
    const p = characterParts;
    const portraitRowHtml = extractCharacterPortraitRowHtml(focusHtml);
    return (
      <div
        className={`${styles.host} ${className ?? ""}`.trim()}
        data-focus-body-editor="true"
        data-hg-lore-hybrid-focus="character"
      >
        {portraitRowHtml ? (
          <div
            className={styles.portraitHost}
            // Portrait + upload wiring matches legacy focus shell (mousedown on canvas handles upload).
            dangerouslySetInnerHTML={{ __html: portraitRowHtml }}
          />
        ) : null}
        <div className={styles.fieldRow}>
          <span className={styles.label}>Name</span>
          <textarea
            className={styles.textarea}
            rows={2}
            value={htmlToPlainOneLine(p.displayName)}
            onChange={(e) => {
              const next = { ...p, displayName: plainToFieldHtml(e.target.value) };
              setCharacterParts(next);
              emitCharacter(next, notesDocRef.current);
            }}
          />
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.label}>Role</span>
          <textarea
            className={styles.textarea}
            rows={2}
            value={htmlToPlainOneLine(p.role)}
            onChange={(e) => {
              const next = { ...p, role: plainToFieldHtml(e.target.value) };
              setCharacterParts(next);
              emitCharacter(next, notesDocRef.current);
            }}
          />
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.label}>Affiliation</span>
          <textarea
            className={styles.textarea}
            rows={2}
            value={htmlToPlainOneLine(p.affiliation)}
            onChange={(e) => {
              const next = { ...p, affiliation: plainToFieldHtml(e.target.value) };
              setCharacterParts(next);
              emitCharacter(next, notesDocRef.current);
            }}
          />
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.label}>Nationality</span>
          <textarea
            className={styles.textarea}
            rows={2}
            value={htmlToPlainOneLine(p.nationality)}
            onChange={(e) => {
              const next = { ...p, nationality: plainToFieldHtml(e.target.value) };
              setCharacterParts(next);
              emitCharacter(next, notesDocRef.current);
            }}
          />
        </div>
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
