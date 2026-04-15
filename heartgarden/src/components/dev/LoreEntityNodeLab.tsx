"use client";

/**
 * Lore entity node design lab. Location v6 uses legacy rich HTML (`BufferedContentEditable`); v7 uses **`HeartgardenDocEditor`**
 * (hgDoc / TipTap) for notes. Production wiring can use
 * `items.entity_type` (character | faction | location) plus optional `content_json.hgArch`
 * keys such as `cardVariant` once a direction is chosen.
 *
 * **Body vs document shell:** Character v11 uses **`LabSkeuoCard`** (body-only canvas plate; same stack as production).
 * Faction lab previews use **`FactionLabPlate`** (lab-only chrome) — not **`LabCard`**, so they are not constrained to
 * tape or `a4DocumentBody`. Shelf variants use **`ArchitecturalNodeHeader`** for the expand affordance. Location v2–v3
 * use **`LabCard`** to match canvas A4 nodes; v4–v7 are lab-only **`FactionLabPlate`** ORDO mono slabs — v4 static fiction;
 * v5 dense field-mapped; v6 lean **`BufferedContentEditable`** body; v7 lean slab + TipTap notes (**`HeartgardenDocEditor`**) + lab `contentEditable` name/context/detail.
 */

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { JSONContent } from "@tiptap/core";

import { ArchitecturalTooltip } from "@/src/components/foundation/ArchitecturalTooltip";
import {
  ArchitecturalNodeHeader,
  ArchitecturalNodeTape,
} from "@/src/components/foundation/ArchitecturalNodeCard";
import { ArrowsOutSimple } from "@phosphor-icons/react";
import canvasStyles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import cardStyles from "@/src/components/foundation/lore-entity-card.module.css";
import { VigilThemeProvider, useVigilThemeContext } from "@/src/contexts/vigil-theme-context";
import { cx } from "@/src/lib/cx";
import type { TapeVariant } from "@/src/components/foundation/architectural-types";
import { Button } from "@/src/components/ui/Button";
import { BufferedContentEditable } from "@/src/components/editing/BufferedContentEditable";
import { HeartgardenDocEditor } from "@/src/components/editing/HeartgardenDocEditor";
import type { EditorCommitReason } from "@/src/components/editing/useEditorSession";

import labStyles from "./lore-entity-node-lab.module.css";
import {
  getLoreNodeSeedBodyHtml,
  locationStripVariantFromSeed,
} from "@/src/lib/lore-node-seed-html";
import { syncCharSkDisplayNameStack } from "@/src/lib/lore-char-sk-display-name";
import { installLoreV11PlaceholderCaretSync } from "@/src/lib/lore-v11-ph-caret";
import {
  consumeLorePlaceholderBeforeInput,
  installLorePlaceholderSelectionGuards,
  placeCaretAfterLorePlaceholderReplace,
  syncLoreV9RedactedPlaceholderState,
} from "@/src/lib/lore-v9-placeholder";
import { applyImageDataUrlToArchitecturalMediaBody } from "@/src/components/foundation/architectural-media-html";
import { applySpellcheckToNestedEditables } from "@/src/lib/contenteditable-spellcheck";

function LabCard({
  headerTitle,
  tapeVariant,
  tapeRotation,
  className,
  children,
}: {
  headerTitle: string;
  tapeVariant: TapeVariant;
  tapeRotation: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        canvasStyles.entityNode,
        canvasStyles.themeDefault,
        canvasStyles.a4DocumentNode,
        className,
      )}
      style={{ width: 340, "--entity-width": "340px" } as CSSProperties}
    >
      <ArchitecturalNodeTape variant={tapeVariant} rotationDeg={tapeRotation} />
      <ArchitecturalNodeHeader
        title={headerTitle}
        showExpand={false}
        onExpand={() => {}}
        buttonTone="card-light"
      />
      <div className={labStyles.labBody}>{children}</div>
    </div>
  );
}

/**
 * Lab-only faction specimen — not a canvas lore node: no tape, no node header, no `a4DocumentBody` / `labBody`.
 * Uses neutral layout + tokens so previews can diverge structurally from canvas lore cards.
 */
function FactionLabPlate({
  plateKind,
  className,
  children,
}: {
  plateKind:
    | "slip"
    | "stub"
    | "iomemo"
    | "shelfcard"
    | "shelfcardSleeve"
    | "protocolOrdo"
    | "protocolOrdoCompact"
    | "protocolOrdoCompactMono"
    | "protocolSynod"
    | "protocolArchive091"
    | "protocolLattice"
    | "protocolAeonConclave"
    | "protocolAeonProtocol";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(labStyles.factionLabPlate, labStyles[`factionLabPlate_${plateKind}`], className)}
      data-hg-lab-faction-plate={plateKind}
      style={{ width: 340, "--entity-width": "340px" } as CSSProperties}
    >
      {children}
    </div>
  );
}

/** 8×8 pixel mark for protocol Ordo plate (CSS grid paints “on” cells). */
const FAC_ORDO_PIXEL_GRID: readonly (0 | 1)[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
];

function ProtocolOrdoLiveClock() {
  const [label, setLabel] = useState("00:00:00:00");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const timeStr = [now.getHours(), now.getMinutes(), now.getSeconds(), Math.floor(now.getMilliseconds() / 10)]
        .map((v) => v.toString().padStart(2, "0"))
        .join(":");
      setLabel(timeStr);
    };
    tick();
    const id = window.setInterval(tick, 50);
    return () => window.clearInterval(id);
  }, []);
  return <span suppressHydrationWarning>{label}</span>;
}

/** ORDO LUNARIS–style protocol sheet (lab-only; not canvas wiring). */
function FactionProtocolOrdoBody({ testId }: { testId: string }) {
  return (
    <div className={labStyles.facOrdoRoot} data-testid={testId}>
      <div className={labStyles.facOrdoGeo} aria-hidden />
      <div className={labStyles.facOrdoGlow} aria-hidden />
      <div className={labStyles.facOrdoInner}>
        <header className={labStyles.facOrdoHeader}>
          <div className={labStyles.facOrdoLogoBlock}>
            <div className={labStyles.facOrdoPixelIcon} aria-hidden>
              {FAC_ORDO_PIXEL_GRID.map((row, ri) =>
                row.map((on, ci) => (
                  <span
                    key={`${ri}-${ci}`}
                    className={cx(labStyles.facOrdoPx, !on && labStyles.facOrdoPxOff)}
                  />
                )),
              )}
            </div>
            <span className={labStyles.facOrdoBrand}>ORDO LUNARIS</span>
          </div>
          <div className={labStyles.facOrdoSystemData}>
            <div>CLEARANCE: CHARTER</div>
            <div>
              <ProtocolOrdoLiveClock />
            </div>
            <div>LAT: 52.5200° N</div>
            <div>LON: 13.4050° E</div>
          </div>
        </header>

        <div className={labStyles.facOrdoDocGrid}>
          <div className={labStyles.facOrdoTitleRow}>
            <h1 className={labStyles.facOrdoDisplayTitle}>
              IRON
              <br />
              WOOD
            </h1>
            <div className={labStyles.facOrdoSecondaryTitle}>
              PROTO
              <br />
              COL 09
            </div>
          </div>

          <div className={labStyles.facOrdoMetaStamp}>
            ESTABLISHED 02.02.18
            <br />
            REVISED 21.11.23
            <br />
            SUBJECT: EXCHANGE CHARTER
            <br />
            REF: ORG-7741
          </div>

          <div className={labStyles.facOrdoMain}>
            <div className={labStyles.facOrdoContentBlock}>
              <h2 className={labStyles.facOrdoSectionLabel}>I. INITIATION DECREE</h2>
              <p className={labStyles.facOrdoP}>
                The ritual of the <span className={labStyles.facOrdoRedacted}>REDACTED</span> must be observed with
                clinical precision. Harbor alignment is biological: we breathe the frequency of the ledger. We become
                the echo.
              </p>
              <p className={labStyles.facOrdoP}>
                The architecture of the exchange demands total surrender of the self to the machine of tariffs.
              </p>
              <span className={labStyles.facOrdoBtn}>ACKNOWLEDGE PROTOCOL</span>
            </div>
            <div className={labStyles.facOrdoContentBlock}>
              <h2 className={labStyles.facOrdoSectionLabel}>II. OPERATIONAL GEOMETRY</h2>
              <p className={labStyles.facOrdoP}>
                The circles must overlap. The centers must never touch. The coral core is the only truth in a gray
                world. If the signal drifts beyond 0.04Hz, the{" "}
                <span className={labStyles.facOrdoRedacted}>REDACTED</span> will initiate immediately.
              </p>
            </div>
          </div>

          <aside className={labStyles.facOrdoSidebar} aria-label="Protocol margin notes">
            <div className={labStyles.facOrdoBox}>
              <svg className={labStyles.facOrdoArrowSvg} viewBox="0 0 24 24" aria-hidden>
                <path d="M7 17L17 7M17 7H8M17 7V16" />
              </svg>
              <div className={labStyles.facOrdoBoxText}>
                <strong>NODE 01</strong>
                <br />
                ASCENSION FREQUENCY: 88.2 KHZ
              </div>
            </div>
            <div className={cx(labStyles.facOrdoBox, labStyles.facOrdoBoxDashed)}>
              <strong>WARNING:</strong>
              <br />
              FAILURE TO COMPLY WITH PROTOCOL 09 RESULTS IN PERMANENT SIGNAL DEGRADATION.
            </div>
          </aside>

          <div className={labStyles.facOrdoFooterStrip}>
            00101101 // X-RAY // V-SYSTEM // LUNAR // ECHO // PROTOCOL 09
          </div>
        </div>
      </div>
    </div>
  );
}

/** VI · Compact ORDO LUNARIS — same family as VII, fewer blocks + tighter system sizing for the 340px plate. */
function FactionProtocolOrdoCompactBody({
  testId,
  brandLabel = "ORDO LUNARIS",
}: {
  testId: string;
  brandLabel?: string;
}) {
  return (
    <div className={labStyles.facOrdoRoot} data-testid={testId}>
      <div className={labStyles.facOrdoGeo} aria-hidden />
      <div className={labStyles.facOrdoGlow} aria-hidden />
      <div className={labStyles.facOrdoInner}>
        <header className={labStyles.facOrdoHeader}>
          <div className={labStyles.facOrdoLogoBlock}>
            <div className={labStyles.facOrdoPixelIcon} aria-hidden>
              {FAC_ORDO_PIXEL_GRID.map((row, ri) =>
                row.map((on, ci) => (
                  <span
                    key={`${ri}-${ci}`}
                    className={cx(labStyles.facOrdoPx, !on && labStyles.facOrdoPxOff)}
                  />
                )),
              )}
            </div>
            <span className={labStyles.facOrdoBrand}>{brandLabel}</span>
          </div>
          <div className={labStyles.facOrdoSystemData}>
            <div>CLEARANCE: CHARTER</div>
            <div>
              <ProtocolOrdoLiveClock />
            </div>
            <div>LAT: 52.5200° N</div>
            <div>LON: 13.4050° E</div>
          </div>
        </header>

        <div className={labStyles.facOrdoDocGrid}>
          <div className={labStyles.facOrdoTitleRow}>
            <h1 className={labStyles.facOrdoDisplayTitle}>
              IRON
              <br />
              WOOD
            </h1>
            <div className={labStyles.facOrdoSecondaryTitle}>
              PROTO
              <br />
              COL 09
            </div>
          </div>

          <div className={labStyles.facOrdoMetaStamp}>REF: ORG-7741 · SUBJECT: EXCHANGE CHARTER</div>

          <div className={labStyles.facOrdoMain}>
            <div className={labStyles.facOrdoContentBlock}>
              <h2 className={labStyles.facOrdoSectionLabel}>I. INITIATION DECREE</h2>
              <p className={labStyles.facOrdoP}>
                The ritual of the <span className={labStyles.facOrdoRedacted}>REDACTED</span> must be observed with
                clinical precision — harbor alignment to the ledger frequency; surrender to the machine of tariffs.
              </p>
            </div>
          </div>

          <div className={labStyles.facOrdoFooterStrip}>
            // LUNAR // ECHO // NODE 01 // PROTOCOL 09
          </div>
        </div>
      </div>
    </div>
  );
}

/** Deterministic pseudo-coordinates so the same ref always charts the same bearing in the lab. */
function labStableLatLonFromSeed(seed: string): { lat: string; lon: string } {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const lat = 48 + (h % 700) / 100;
  const lon = 6 + ((h >> 12) % 1100) / 100;
  return {
    lat: `${lat.toFixed(4)}° N`,
    lon: `${lon.toFixed(4)}° E`,
  };
}

function locOrdoV5ContextAcronym(context: string): string {
  const parts = context.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 6).toUpperCase();
  return parts
    .map((p) => p[0])
    .join("")
    .slice(0, 6)
    .toUpperCase();
}

function locOrdoV5SplitDisplayName(name: string): { line1: string; line2: string | null } {
  const t = name.trim();
  if (!t) return { line1: "UNTITLED", line2: null };
  const words = t.split(/\s+/);
  if (words.length === 1) return { line1: words[0].toUpperCase(), line2: null };
  const mid = Math.ceil(words.length / 2);
  return {
    line1: words.slice(0, mid).join(" ").toUpperCase(),
    line2: words.slice(mid).join(" ").toUpperCase(),
  };
}

function escapeHtmlForOrdoDoc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function notesToHgDoc(text: string): JSONContent {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
  };
}

/** Initial HTML for V6 slab document region — same field slots + classes as the static slab; edited via {@link BufferedContentEditable}. */
function buildLocationOrdoV6DocHtml(
  s: typeof labStyles,
  line1: string,
  line2: string | null,
  context: string,
  detail: string,
  notes: string,
): string {
  const nameBr = line2 ? `<br />${escapeHtmlForOrdoDoc(line2)}` : "";
  return `<div class="${s.facOrdoDocGrid}"><div class="${s.facOrdoTitleRow}"><h1 class="${s.facOrdoDisplayTitle}" data-hg-lore-location-field="name">${escapeHtmlForOrdoDoc(line1)}${nameBr}</h1></div><p class="${s.facOrdoLocV6ContextLine}" data-hg-lore-location-field="context">${escapeHtmlForOrdoDoc(context)}</p><div class="${s.facOrdoMain}"><div class="${s.facOrdoContentBlock} ${s.facOrdoLocV5DocInline}"><p class="${s.facOrdoLocV5DetailLine}" data-hg-lore-location-field="detail">${escapeHtmlForOrdoDoc(detail)}</p><div class="${s.facOrdoLocV5NotesCell}" data-hg-lore-location-notes-cell="true"><div data-hg-lore-location-notes="true" class="${s.facOrdoLocV5NotesInner}"><p class="${s.facOrdoP}">${escapeHtmlForOrdoDoc(notes)}</p></div></div></div></div></div>`;
}

/** Slash menu → `document.execCommand` (same command ids as canvas legacy `runFormat`; checklist/image omitted in lab). */
function labOrdoSlashRichDocCommand(command: string, value?: string) {
  if (command === "arch:insertImage" || command === "arch:checklist") return;
  if (command === "formatBlock" && value) {
    document.execCommand("formatBlock", false, value);
    return;
  }
  document.execCommand(command, false, value);
}

/**
 * V5 · ORDO coordinate slab — same mono plate as v4, but DOM uses `lore-location` field slots (name / context / detail /
 * ref / notes). LAT/LON are a stable lab hash of the ref (not geocoding).
 */
function LocationOrdoCoordinateSlabV5Body({ testId }: { testId: string }) {
  const name = "Old Harbor Kiln No. 4";
  const context = "Kestrel Free City";
  const detail = "Dock ward · industrial brick";
  const ref = "KFC-DOCK-0847";
  const notesExcerpt =
    "Color band suggests landscape / atmosphere without an image asset. Strip uses the same full-bleed inset as the v3 survey bar — kiln shell still radiates dusk heat.";

  /** Lab specimen: survey fix + datum + elevation (MSL) — matches header LAT/LON rail tone. */
  const surveyFix = "2026-04-13";
  const datum = "WGS84";
  const elevMslM = "8.2";

  const { lat, lon } = labStableLatLonFromSeed(`${ref}|${name}`);
  const { line1, line2 } = locOrdoV5SplitDisplayName(name);
  const gridLabel = locOrdoV5ContextAcronym(context);
  const nodeTag = ref.split(/[-\s]/).pop() ?? ref;
  const footerWard = (detail.split("·")[0]?.trim() ?? detail).toUpperCase();

  return (
    <div
      className={labStyles.facOrdoRoot}
      data-testid={testId}
      data-hg-canvas-role="lore-location"
      data-hg-lore-location-variant="v5"
    >
      <div className={labStyles.facOrdoGeo} aria-hidden />
      <div className={labStyles.facOrdoGlow} aria-hidden />
      <div className={labStyles.facOrdoInner}>
        <header className={labStyles.facOrdoHeader}>
          <div className={labStyles.facOrdoLogoBlock}>
            <div className={labStyles.facOrdoPixelIcon} aria-hidden>
              {FAC_ORDO_PIXEL_GRID.map((row, ri) =>
                row.map((on, ci) => (
                  <span
                    key={`${ri}-${ci}`}
                    className={cx(labStyles.facOrdoPx, !on && labStyles.facOrdoPxOff)}
                  />
                )),
              )}
            </div>
            <span className={cx(labStyles.facOrdoBrand, labStyles.facOrdoLocV5BrandRef)}>LOCATION</span>
          </div>
          <div className={labStyles.facOrdoSystemData}>
            <div>REF: {ref}</div>
            <div>CHARTER: HARBOR EXCHANGE</div>
            <div>LAT: {lat}</div>
            <div>LON: {lon}</div>
          </div>
        </header>

        <div className={labStyles.facOrdoDocGrid}>
          <div className={labStyles.facOrdoTitleRow}>
            <h1 className={labStyles.facOrdoDisplayTitle} data-hg-lore-location-field="name">
              {line1}
              {line2 ? (
                <>
                  <br />
                  {line2}
                </>
              ) : null}
            </h1>
          </div>

          <div className={cx(labStyles.facOrdoMetaStamp, labStyles.facOrdoLocV5MetaStamp)}>
            <div>
              REF: <span data-hg-lore-location-field="ref">{ref}</span> · SUBJECT:{" "}
              <span data-hg-lore-location-field="context">{context}</span>
            </div>
            <div className={labStyles.facOrdoLocV5MetaStampSecond}>
              FIX: {surveyFix} · DATUM: {datum} · ELV: {elevMslM} M MSL
            </div>
          </div>

          <div className={labStyles.facOrdoMain}>
            <div className={cx(labStyles.facOrdoContentBlock, labStyles.facOrdoLocV5DocInline)}>
              <h2 className={cx(labStyles.facOrdoSectionLabel, labStyles.facOrdoLocV5DocEyebrow)}>
                I. SITE RECORD
              </h2>
              <p className={labStyles.facOrdoLocV5DetailLine} data-hg-lore-location-field="detail">
                {detail}
              </p>
              <div
                className={labStyles.facOrdoLocV5NotesCell}
                data-hg-lore-location-notes-cell="true"
                contentEditable={false}
              >
                <div
                  data-hg-lore-location-notes="true"
                  contentEditable={false}
                  className={labStyles.facOrdoLocV5NotesInner}
                >
                  <p className={labStyles.facOrdoP}>{notesExcerpt}</p>
                </div>
              </div>
            </div>
          </div>

          <div className={labStyles.facOrdoFooterStrip}>
            // {gridLabel} // {footerWard} // NODE {nodeTag}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * V6 · Lean ORDO mono slab — `lore-location` field slots in one **`BufferedContentEditable`** (legacy rich HTML, same
 * family as canvas default/task node bodies: `/` slash blocks, execCommand formatting, optional checklist rows). Header
 * is LOCATION + expand only. Vault search still indexes `title` + `contentText`, not per-field keys.
 */
function LocationOrdoCoordinateSlabV6Body({ testId }: { testId: string }) {
  const name = "Old Harbor Kiln No. 4";
  const context = "Kestrel Free City";
  const detail = "Dock ward · industrial brick";
  const notesExcerpt =
    "Color band suggests landscape / atmosphere without an image asset. Strip uses the same full-bleed inset as the v3 survey bar — kiln shell still radiates dusk heat.";

  const { line1, line2 } = locOrdoV5SplitDisplayName(name);
  const [docHtml, setDocHtml] = useState(() =>
    buildLocationOrdoV6DocHtml(labStyles, line1, line2, context, detail, notesExcerpt),
  );

  const onDocCommit = useCallback((next: string, _reason: EditorCommitReason) => {
    setDocHtml(next);
  }, []);

  return (
    <div
      className={labStyles.facOrdoRoot}
      data-testid={testId}
      data-hg-canvas-role="lore-location"
      data-hg-lore-location-variant="v6"
    >
      <div className={labStyles.facOrdoGeo} aria-hidden />
      <div className={labStyles.facOrdoGlow} aria-hidden />
      <div className={labStyles.facOrdoInner}>
        <header className={labStyles.facOrdoHeader}>
          <div className={labStyles.facOrdoLogoBlock}>
            <div className={labStyles.facOrdoPixelIcon} aria-hidden>
              {FAC_ORDO_PIXEL_GRID.map((row, ri) =>
                row.map((on, ci) => (
                  <span
                    key={`${ri}-${ci}`}
                    className={cx(labStyles.facOrdoPx, !on && labStyles.facOrdoPxOff)}
                  />
                )),
              )}
            </div>
            <span className={cx(labStyles.facOrdoBrand, labStyles.facOrdoLocV5BrandRef)}>LOCATION</span>
          </div>
          <div className={labStyles.facOrdoHeaderRight}>
            <ArchitecturalTooltip content="Expand object" side="bottom" delayMs={320}>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                tone="card-light"
                className={labStyles.facOrdoHeaderExpandBtn}
                data-expand-btn="true"
                aria-label="Expand object"
                onClick={() => {}}
              >
                <ArrowsOutSimple size={14} />
              </Button>
            </ArchitecturalTooltip>
          </div>
        </header>

        <BufferedContentEditable
          value={docHtml}
          className={cx(labStyles.facOrdoV6RichHost)}
          editable
          spellCheck
          debounceMs={300}
          wikiLinkAssist={null}
          richDocCommand={labOrdoSlashRichDocCommand}
          emptyPlaceholder="Edit location fields…"
          checklistDeletion={{
            taskItem: canvasStyles.taskItem,
            taskText: canvasStyles.taskText,
            taskCheckbox: canvasStyles.taskCheckbox,
          }}
          onCommit={onDocCommit}
          dataAttribute="data-node-body-editor"
        />
      </div>
    </div>
  );
}

/** Isolated from notes state so TipTap re-renders do not reset `contentEditable` primary fields mid-typing. */
const LocOrdoV7TitleAndContext = memo(function LocOrdoV7TitleAndContext({
  name,
  context,
  onNameCommit,
  onContextCommit,
}: {
  name: string;
  context: string;
  onNameCommit: (next: string) => void;
  onContextCommit: (next: string) => void;
}) {
  const { line1, line2 } = useMemo(() => locOrdoV5SplitDisplayName(name), [name]);
  return (
    <>
      <div className={labStyles.facOrdoTitleRow}>
        <h1
          className={labStyles.facOrdoDisplayTitle}
          data-hg-lore-location-field="name"
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => {
            const t = e.currentTarget.innerText.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
            if (t) onNameCommit(t);
          }}
        >
          {line1}
          {line2 ? (
            <>
              <br />
              {line2}
            </>
          ) : null}
        </h1>
      </div>
      <p
        className={labStyles.facOrdoLocV6ContextLine}
        data-hg-lore-location-field="context"
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => {
          onContextCommit(e.currentTarget.innerText.replace(/\s+/g, " ").trim());
        }}
      >
        {context}
      </p>
    </>
  );
});

const LocOrdoV7DetailLine = memo(
  forwardRef<
    HTMLParagraphElement,
    {
      detail: string;
      onDetailCommit: (next: string) => void;
    }
  >(function LocOrdoV7DetailLine({ detail, onDetailCommit }, ref) {
    return (
      <p
        ref={ref}
        className={labStyles.facOrdoLocV5DetailLine}
        data-hg-lore-location-field="detail"
        data-placeholder="Ward · material · micro-context"
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => {
          onDetailCommit(e.currentTarget.innerText.replace(/\s+/g, " ").trim());
        }}
      >
        {detail}
      </p>
    );
  }),
);
LocOrdoV7DetailLine.displayName = "LocOrdoV7DetailLine";

/**
 * V7 · Same lean chrome as V6 (LOCATION + expand, achromatic mono plate), but **notes** use **`HeartgardenDocEditor`**
 * (hgDoc / TipTap: `/` blocks, full schema). **Name / context / detail** are structured `contentEditable` fields in the
 * lab (V6 uses one `BufferedContentEditable` HTML region instead).
 */
function LocationOrdoCoordinateSlabV7Body({ testId }: { testId: string }) {
  const [name, setName] = useState("Old Harbor Kiln No. 4");
  const [context, setContext] = useState("Kestrel Free City");
  const [detail, setDetail] = useState("Dock ward · industrial brick");
  /** When true, show the detail slot even if `detail` is empty (user chose “add site detail”). */
  const [detailSlotOpen, setDetailSlotOpen] = useState(false);
  const detailLineRef = useRef<HTMLParagraphElement | null>(null);

  const notesSeed =
    "Color band suggests landscape / atmosphere without an image asset. Strip uses the same full-bleed inset as the v3 survey bar — kiln shell still radiates dusk heat.";

  const [notesDoc, setNotesDoc] = useState<JSONContent>(() => notesToHgDoc(notesSeed));

  const showDetailLine = detail.trim().length > 0 || detailSlotOpen;

  useLayoutEffect(() => {
    if (!detailSlotOpen || detail.trim().length > 0) return;
    detailLineRef.current?.focus();
  }, [detailSlotOpen, detail]);

  return (
    <div
      className={labStyles.facOrdoRoot}
      data-testid={testId}
      data-hg-canvas-role="lore-location"
      data-hg-lore-location-variant="v7"
    >
      <div className={labStyles.facOrdoGeo} aria-hidden />
      <div className={labStyles.facOrdoGlow} aria-hidden />
      <div className={labStyles.facOrdoInner}>
        <header className={labStyles.facOrdoHeader}>
          <div className={labStyles.facOrdoLogoBlock}>
            <div className={labStyles.facOrdoPixelIcon} aria-hidden>
              {FAC_ORDO_PIXEL_GRID.map((row, ri) =>
                row.map((on, ci) => (
                  <span
                    key={`${ri}-${ci}`}
                    className={cx(labStyles.facOrdoPx, !on && labStyles.facOrdoPxOff)}
                  />
                )),
              )}
            </div>
            <span className={cx(labStyles.facOrdoBrand, labStyles.facOrdoLocV5BrandRef)}>LOCATION</span>
          </div>
          <div className={labStyles.facOrdoHeaderRight}>
            <ArchitecturalTooltip content="Expand object" side="bottom" delayMs={320}>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                tone="card-light"
                className={labStyles.facOrdoHeaderExpandBtn}
                data-expand-btn="true"
                aria-label="Expand object"
                onClick={() => {}}
              >
                <ArrowsOutSimple size={14} />
              </Button>
            </ArchitecturalTooltip>
          </div>
        </header>

        <div className={labStyles.facOrdoDocGrid}>
          <LocOrdoV7TitleAndContext
            name={name}
            context={context}
            onNameCommit={setName}
            onContextCommit={setContext}
          />

          <div className={labStyles.facOrdoMain}>
            <div className={cx(labStyles.facOrdoContentBlock, labStyles.facOrdoLocV5DocInline)}>
              {showDetailLine ? (
                <LocOrdoV7DetailLine
                  ref={detailLineRef}
                  detail={detail}
                  onDetailCommit={(next) => {
                    setDetail(next);
                    if (!next.trim()) setDetailSlotOpen(false);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={labStyles.facOrdoLocV7DetailAdd}
                  data-hg-lore-location-detail-add="true"
                  aria-label="Add site detail line"
                  onClick={() => {
                    setDetail("");
                    setDetailSlotOpen(true);
                  }}
                >
                  // add site detail
                </button>
              )}
              <div
                className={labStyles.facOrdoLocV5NotesCell}
                data-hg-lore-location-notes-cell="true"
                contentEditable={false}
              >
                <div
                  data-hg-lore-location-notes="true"
                  contentEditable={false}
                  className={labStyles.facOrdoLocV7NotesField}
                >
                  <HeartgardenDocEditor
                    surfaceKey="lab-loc-ordo-v7-notes"
                    chromeRole="canvas"
                    value={notesDoc}
                    onChange={setNotesDoc}
                    showAiPendingGutter={false}
                    placeholder="Notes… type / for blocks"
                    className={labStyles.facOrdoLocV7HgHost}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Silent Synod — legible “brief” layout for the 340px plate (cream / blood accent; dossier + sigil motion omitted). */
function FactionSilentSynodBody({ testId }: { testId: string }) {
  const [dateStr, setDateStr] = useState("");
  useEffect(() => {
    setDateStr(
      new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
    );
  }, []);

  return (
    <div className={labStyles.facSynodRoot} data-testid={testId}>
      <div className={labStyles.facSynodBrief}>
        <header className={labStyles.facSynodBriefHead}>
          <div className={labStyles.facSynodBriefTitleBlock}>
            <p className={labStyles.facSynodBriefEyebrow}>Bureau · transdimensional affairs</p>
            <h1 className={labStyles.facSynodBriefH1}>Silent Synod</h1>
            <p className={labStyles.facSynodBriefCode}>OMEGA-7</p>
          </div>
          <div className={labStyles.facSynodBriefAside}>
            <span className={labStyles.facSynodBriefAsideLine}>DOC-774-B</span>
            <span className={labStyles.facSynodBriefAsideLine} suppressHydrationWarning>
              {dateStr || "—"}
            </span>
            <span className={labStyles.facSynodBriefStatus}>Unresolved</span>
          </div>
        </header>

        <p className={labStyles.facSynodBriefLead}>
          <strong>Constant evolution</strong> — map vectors before entropy lands. Ironwood holds the ledger;{" "}
          <span className={labStyles.facSynodBriefRedact}>the veil</span> holds the charter.
        </p>

        <dl className={labStyles.facSynodBriefFacts}>
          <div className={labStyles.facSynodBriefFact}>
            <dt>Clearance</dt>
            <dd>Level V · eyes only</dd>
          </div>
          <div className={labStyles.facSynodBriefFact}>
            <dt>Risk</dt>
            <dd>Existential erasure</dd>
          </div>
        </dl>

        <section className={labStyles.facSynodBriefSection} aria-label="Standing order">
          <h2 className={labStyles.facSynodBriefH2}>Standing order</h2>
          <p className={labStyles.facSynodBriefP}>
            Report visual echoing to the ward. No static structures past the threshold — when{" "}
            <span className={labStyles.facSynodBriefRedact}>geometries shift</span>, dissolve cleanly.
          </p>
        </section>

        <footer className={labStyles.facSynodBriefFoot}>
          <span className={labStyles.facSynodBriefFootText}>ORG-7741 · Obsidian Reach</span>
          <span className={labStyles.facSynodBriefStamp}>OMEGA</span>
        </footer>
      </div>
    </div>
  );
}

/** ARCHIVE-091 void document (lab-only; dark field, Playfair + mono; no canvas grain / no parallax). */
function FactionArchive091Body({ testId }: { testId: string }) {
  return (
    <div className={labStyles.facArcRoot} data-testid={testId}>
      <div className={labStyles.facArcGrain} aria-hidden />
      <div className={labStyles.facArcPage}>
        <aside className={labStyles.facArcRail} aria-hidden>
          <div className={labStyles.facArcVertical}>Restricted // Access // 091</div>
          <svg className={labStyles.facArcStar} viewBox="0 0 24 24">
            <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" fill="currentColor" />
          </svg>
          <div className={labStyles.facArcVertical}>07652-46738225-415523907</div>
          <div className={labStyles.facArcBarcode} />
        </aside>

        <div className={labStyles.facArcMain}>
          <div className={labStyles.facArcMetaStrip}>
            <span>Ref: VOID_MANIFEST_v4.2</span>
            <span className={labStyles.facArcBlink}>● RECORDING_IN_PROGRESS</span>
            <span>EST: 1984.09.12</span>
          </div>

          <header className={labStyles.facArcLetterhead}>
            <h1 className={labStyles.facArcH1}>Absence</h1>
            <div className={labStyles.facArcSubTitle}>Of Mind</div>
            <div className={labStyles.facArcOrderLine}>By the order of the Void Collective</div>
          </header>

          <div className={labStyles.facArcContentBody}>
            <div className={labStyles.facArcTextSection}>
              <h2 className={labStyles.facArcH2}>The Protocol</h2>
              <p className={labStyles.facArcP}>
                To reach <em className={labStyles.facArcEm}>the Absolute Neutral</em>, surrender the chronological
                anchor. Catalog the exterior, then displace it in the ledger furnace — Ironwood tariff binders only.
              </p>
              <p className={labStyles.facArcP}>
                The horizon does not curve for the eye; it curves for the soul. We are the quiet space between
                charter clauses.
              </p>
              <span className={labStyles.facArcPill}>PHASE-RED-CLEARED</span>
            </div>
            <div className={labStyles.facArcTextSection}>
              <h2 className={labStyles.facArcH2}>Member metrics</h2>
              <table className={labStyles.facArcTable}>
                <tbody>
                  <tr>
                    <td className={labStyles.facArcTdLabel}>Initiate ID</td>
                    <td>#091-ALPHA-9</td>
                  </tr>
                  <tr>
                    <td className={labStyles.facArcTdLabel}>Vibration Hz</td>
                    <td>432.00012</td>
                  </tr>
                  <tr>
                    <td className={labStyles.facArcTdLabel}>Cognitive drift</td>
                    <td>0.002% [STABLE]</td>
                  </tr>
                  <tr>
                    <td className={labStyles.facArcTdLabel}>Ascension prob</td>
                    <td>88.4%</td>
                  </tr>
                  <tr>
                    <td className={labStyles.facArcTdLabel}>Last ritual</td>
                    <td>12.04.2024</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <span className={labStyles.facArcBtn} role="presentation">
            Initiate void protocol
          </span>

          <footer className={labStyles.facArcFooter}>
            <span className={labStyles.facArcPill}>SERIAL: 091-VOID-RKTT</span>
            <div className={labStyles.facArcFooterMid}>All rights forfeited to the void · Obsidian Reach registry</div>
            <div className={labStyles.facArcBarcode} />
          </footer>
        </div>

        <aside className={labStyles.facArcRail} aria-hidden>
          <svg className={labStyles.facArcStar} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="0.5" />
            <path d="M12 2L12 22 M2 12 L22 12" stroke="currentColor" strokeWidth="0.5" />
          </svg>
          <div className={labStyles.facArcVertical}>System // status // nominal</div>
          <div className={labStyles.facArcVertical}>Encrypted // channel // 091</div>
          <span className={labStyles.facArcPillVert}>091</span>
        </aside>
      </div>
    </div>
  );
}

/** Lattice induction — legible “notice” layout for 340px: masthead, stat rows, one obligation; avatar + micro-meta omitted. */
function FactionLatticeInductionBody({ testId }: { testId: string }) {
  return (
    <div className={labStyles.facLatRoot} data-testid={testId}>
      <div className={labStyles.facLatScanlines} aria-hidden />
      <div className={labStyles.facLatDoc}>
        <header className={labStyles.facLatMast}>
          <div className={labStyles.facLatLogoMark} aria-hidden />
          <div className={labStyles.facLatMastText}>
            <div className={labStyles.facLatMastTitle}>The Lattice</div>
            <div className={labStyles.facLatMastSub}>Induction · HG-LATTICE · enrollment open</div>
          </div>
        </header>

        <p className={labStyles.facLatLead}>
          Offer: the title of <span className={labStyles.facLatRedacted}>Primary vessel</span> within the Obsidian
          Reach charter ring.
        </p>

        <ul className={labStyles.facLatStatList} aria-label="Terms">
          <li className={labStyles.facLatStatRow}>
            <span className={labStyles.facLatStatLabel}>Charter stake</span>
            <span className={labStyles.facLatStatVal}>∞ fixed</span>
          </li>
          <li className={labStyles.facLatStatRow}>
            <span className={labStyles.facLatStatLabel}>Quorum</span>
            <span className={labStyles.facLatStatVal}>21 Dec</span>
          </li>
          <li className={labStyles.facLatStatRow}>
            <span className={labStyles.facLatStatLabel}>Review</span>
            <span className={labStyles.facLatStatVal}>9 cycles</span>
          </li>
        </ul>

        <p className={labStyles.facLatOblig}>
          Obligation: hold the Ironwood ledger mesh coherent; invoke{" "}
          <span className={labStyles.facLatRedacted}>Silencing protocol</span> on divergent tariff paths.
        </p>

        <footer className={labStyles.facLatFooter}>
          <div className={labStyles.facLatDecline}>
            Renounce <span aria-hidden>×</span>
          </div>
          <div className={labStyles.facLatAccept}>
            <div className={labStyles.facLatAcceptInner}>
              Accept induction <span className={labStyles.facLatArrow}>→</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

/** XI · AEON Conclave terminal sheet — light field, crimson accent, mono rail; lab-only, static (no clock / pointer FX). */
function FactionAeonConclaveBody({ testId }: { testId: string }) {
  return (
    <div className={labStyles.facAeonRoot} data-testid={testId}>
      <header className={labStyles.facAeonTopBar}>
        <div className={labStyles.facAeonTopLeft}>
          <span className={labStyles.facAeonStatusDot} aria-hidden />
          <span>Classified · level 9 clearance only</span>
        </div>
        <div className={labStyles.facAeonTopRight}>TS-661.00 · 14:32:08</div>
      </header>

      <div className={labStyles.facAeonLetterhead}>
        <h1 className={labStyles.facAeonDisplay}>
          AEON
          <br />
          CONCLAVE
        </h1>
        <div className={labStyles.facAeonSubhead}>
          <span>Office of the prime arbiter</span>
          <span>Doc ref · HG-77-ALPHA-VOID</span>
        </div>
      </div>

      <div className={labStyles.facAeonGrid}>
        <aside className={labStyles.facAeonMeta} aria-label="Document metadata">
          <div className={labStyles.facAeonMetaRow}>
            <span>Subject</span>
            <span>The great pillar</span>
          </div>
          <div className={labStyles.facAeonMetaRow}>
            <span>Date</span>
            <span>Nov 14, 2024</span>
          </div>
          <div className={labStyles.facAeonMetaRow}>
            <span>Origin</span>
            <span>Sector 7-G</span>
          </div>
          <div className={labStyles.facAeonMetaRow}>
            <span>Handling</span>
            <span>Eyes only</span>
          </div>
          <div className={labStyles.facAeonMetaBlock}>
            <div className={labStyles.facAeonMetaRow}>
              <span>Stability</span>
              <span>Critical</span>
            </div>
          </div>
        </aside>

        <section className={labStyles.facAeonContent} aria-label="Transmission body">
          <span className={labStyles.facAeonParaNum}>001</span>
          <p className={labStyles.facAeonP}>
            As established in the prior quorum, the presence of the{" "}
            <span className={labStyles.facAeonRedacted}>Obsidian monolith</span> within the harbor lower vault has begun
            to manifest structural drift in local ledger coherence. Initial sensor readings suggest non-linear temporal
            leakage. We are no longer cataloging an artifact; we are looking at an aperture.
          </p>

          <div className={labStyles.facAeonVisual} aria-hidden>
            <div className={labStyles.facAeonOrb} />
            <div className={labStyles.facAeonOrbMid} />
            <div className={labStyles.facAeonOrbSm} />
            <div className={labStyles.facAeonFigCap}>Fig 1.0 · radiant field capture (7.21ms)</div>
          </div>

          <span className={labStyles.facAeonParaNum}>002</span>
          <p className={labStyles.facAeonP}>
            Participants scheduled for the <span className={labStyles.facAeonRedacted}>ascension rite</span> must be
            notified of increased volatility. The Conclave does not guarantee physical cohesion past the threshold. Those
            who experience <strong className={labStyles.facAeonStrong}>visual echoing</strong> are to report immediately
            to the Sanitization Ward.
          </p>

          <span className={labStyles.facAeonParaNum}>003</span>
          <p className={labStyles.facAeonP}>
            The following coordinates have been struck from all public maps:{" "}
            <span className={labStyles.facAeonRedacted}>45.892° N, 12.001° E</span>. Communication regarding the Sound
            of the Bone will be met with immediate{" "}
            <span className={labStyles.facAeonRedacted}>Silencing protocol 4</span>.
          </p>

          <div className={labStyles.facAeonSignature}>
            <div className={labStyles.facAeonSignCol}>
              <div className={labStyles.facAeonCertLabel}>Certified by</div>
              <div className={labStyles.facAeonSignName}>A. V. Valerius</div>
              <div className={labStyles.facAeonSignRole}>High priest · ops director</div>
            </div>
            <div className={labStyles.facAeonSeal}>VOID</div>
          </div>
        </section>
      </div>

      <div className={labStyles.facAeonFooterRail}>Ironwood conclave · Obsidian Reach registry · void transmission</div>
    </div>
  );
}

/** XII · AEON Protocol classified — concrete field, red/mint aura, grain; legible 340px sheet (static; no pointer FX). */
function FactionAeonProtocolClassifiedBody({ testId }: { testId: string }) {
  return (
    <div className={labStyles.facAeonProtoRoot} data-testid={testId}>
      <div className={labStyles.facAeonProtoAura} aria-hidden />
      <div className={labStyles.facAeonProtoGrain} aria-hidden />
      <div className={labStyles.facAeonProtoDoc}>
        <span className={labStyles.facAeonProtoChTL} aria-hidden />
        <span className={labStyles.facAeonProtoChTR} aria-hidden />
        <span className={labStyles.facAeonProtoChBL} aria-hidden />
        <span className={labStyles.facAeonProtoChBR} aria-hidden />

        <div className={labStyles.facAeonProtoTop}>
          <div className={labStyles.facAeonProtoStampLeft}>
            <span className={labStyles.facAeonProtoSlashed}>28.02.2025</span>
            <span>INDEX_0089</span>
            <span className={labStyles.facAeonProtoIndexNum} aria-hidden>
              09
            </span>
          </div>
          <div className={labStyles.facAeonProtoHeaderRight}>
            <span>28FEB&apos;25</span>
            <span>ORD—AEON</span>
            <span>
              LEVEL—<span className={labStyles.facAeonProtoSlashed}>0</span>7
            </span>
            <span>ARCHIVE</span>
          </div>
        </div>

        <h2 className={labStyles.facAeonProtoSubject}>
          <span className={labStyles.facAeonProtoSubjectDot} aria-hidden />
          Subject: initiation of protocol Ø-9
        </h2>

        <div className={labStyles.facAeonProtoBody}>
          <p>
            Manifestation began at <span className={labStyles.facAeonProtoRedact}>14:22 HRS</span> in the primary
            sanctum. Observers noted atmospheric shift and{" "}
            <span className={labStyles.facAeonProtoRedact}>spectral resonance</span> beyond nominal thresholds.
          </p>
          <p>
            Maintain silence until final sync — scrub auditory data per Aeon Protocol. Do not fix on the{" "}
            <span className={labStyles.facAeonProtoRedact}>bleeding light</span>. Geometry is no longer Euclidean;
            Obsidian Reach observers only.
          </p>
        </div>

        <div className={labStyles.facAeonProtoGrid}>
          <div className={labStyles.facAeonProtoCell}>
            <span className={labStyles.facAeonProtoLabel}>Coordinates</span>
            <span className={labStyles.facAeonProtoVal}>41.9794° N, 2.8214° E</span>
          </div>
          <div className={labStyles.facAeonProtoCell}>
            <span className={labStyles.facAeonProtoLabel}>Stability</span>
            <span className={labStyles.facAeonProtoVal}>Critical / 0.4%</span>
          </div>
          <div className={labStyles.facAeonProtoCell}>
            <span className={labStyles.facAeonProtoLabel}>Vessel ID</span>
            <span className={labStyles.facAeonProtoVal}>ARKADE—7</span>
          </div>
          <div className={labStyles.facAeonProtoCell}>
            <span className={labStyles.facAeonProtoLabel}>Signature</span>
            <span className={labStyles.facAeonProtoValItalic}>Verified.</span>
          </div>
        </div>

        <div className={labStyles.facAeonProtoBottom}>
          <div className={labStyles.facAeonProtoStampBox}>Eyes only · top secret</div>
          <p className={labStyles.facAeonProtoRegistry}>
            AEON order · Girona branch · unit 9
            <br />
            Director · Ramón Folch · classified registry
          </p>
        </div>

        <div className={labStyles.facAeonProtoCta} role="presentation">
          Initiate scrub sequence
        </div>
      </div>
    </div>
  );
}

/** Shared shelf catalog body — canvas-style expand lives in `ArchitecturalNodeHeader`. */
function FactionShelfCardBody({ testId }: { testId: string }) {
  return (
    <div className={labStyles.facShelfRoot} data-testid={testId}>
      <div className={labStyles.facShelfTitle}>Ironwood Mercantile Exchange</div>
      <div className={labStyles.facShelfLine}>
        <span className={labStyles.facShelfKey}>Jurisdiction</span>
        <span className={labStyles.facShelfDots} aria-hidden />
        <span className={labStyles.facShelfVal}>Obsidian Reach</span>
      </div>
      <div className={labStyles.facShelfLine}>
        <span className={labStyles.facShelfKey}>Class</span>
        <span className={labStyles.facShelfDots} aria-hidden />
        <span className={labStyles.facShelfVal}>Faction · charter registry</span>
      </div>
      <div className={labStyles.facShelfLine}>
        <span className={labStyles.facShelfKey}>Cross-ref</span>
        <span className={labStyles.facShelfDots} aria-hidden />
        <span className={labStyles.facShelfVal}>RG-EMB · harbor tariff</span>
      </div>
      <div className={labStyles.facShelfStamp}>CATALOG · NON-CIRC</div>
    </div>
  );
}

/** Canvas-style shell without tape or header — production character v11 body. */
function LabSkeuoCard({
  className,
  html,
}: {
  className?: string;
  html: string;
}) {
  const [bodyAfterUpload, setBodyAfterUpload] = useState(html);
  const rootRef = useRef<HTMLDivElement>(null);
  const labBodyRef = useRef<HTMLDivElement>(null);
  const portraitFileRef = useRef<HTMLInputElement>(null);

  const portraitCommittedClass = cardStyles.charSkPortraitImg;

  const onPortraitFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const alt =
          file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Portrait";
        setBodyAfterUpload((prev) =>
          applyImageDataUrlToArchitecturalMediaBody(prev, dataUrl, alt, portraitCommittedClass, {
            uploadButtonClass: canvasStyles.mediaUploadBtn,
          }),
        );
      };
      reader.readAsDataURL(file);
    },
    [portraitCommittedClass],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stopCaretDrift = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest("[data-architectural-media-upload]");
      if (t && root.contains(t)) e.preventDefault();
    };
    const onUploadClick = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest("[data-architectural-media-upload]");
      if (!t || !root.contains(t)) return;
      e.preventDefault();
      e.stopPropagation();
      portraitFileRef.current?.click();
    };
    root.addEventListener("mousedown", stopCaretDrift, true);
    root.addEventListener("click", onUploadClick, true);
    return () => {
      root.removeEventListener("mousedown", stopCaretDrift, true);
      root.removeEventListener("click", onUploadClick, true);
    };
  }, [bodyAfterUpload]);

  const displayHtml = bodyAfterUpload;

  useLayoutEffect(() => {
    const body = labBodyRef.current;
    if (body) applySpellcheckToNestedEditables(body, false);
    syncCharSkDisplayNameStack(rootRef.current);
    syncLoreV9RedactedPlaceholderState(rootRef.current);
  }, [displayHtml]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const removeGuards = installLorePlaceholderSelectionGuards(root);
    const removePhCaret = installLoreV11PlaceholderCaretSync(root);
    const onInput = () => {
      syncLoreV9RedactedPlaceholderState(root);
    };
    const onBeforeInput = (e: Event) => {
      const ie = e as InputEvent;
      const field = (ie.target as HTMLElement | null)?.closest?.("[data-hg-lore-field]");
      if (!field || !(field instanceof HTMLElement)) return;
      if (!consumeLorePlaceholderBeforeInput(field, ie)) return;
      syncCharSkDisplayNameStack(root);
      syncLoreV9RedactedPlaceholderState(root);
      queueMicrotask(() => {
        if (field.isConnected) placeCaretAfterLorePlaceholderReplace(field);
      });
    };
    const onFocusOut = (e: FocusEvent) => {
      const t = (e.target as HTMLElement | null)?.closest?.(
        '[class*="charSkDisplayName"][data-hg-lore-field]',
      );
      if (!t || !root.contains(t)) return;
      queueMicrotask(() => {
        syncCharSkDisplayNameStack(root);
        syncLoreV9RedactedPlaceholderState(root);
      });
    };
    root.addEventListener("beforeinput", onBeforeInput, true);
    root.addEventListener("input", onInput, true);
    root.addEventListener("focusout", onFocusOut);
    return () => {
      removeGuards();
      removePhCaret();
      root.removeEventListener("beforeinput", onBeforeInput, true);
      root.removeEventListener("input", onInput, true);
      root.removeEventListener("focusout", onFocusOut);
    };
  }, [displayHtml]);

  return (
    <div
      ref={rootRef}
      className={cx(canvasStyles.entityNode, canvasStyles.loreCharacterCanvasRoot, className)}
      data-hg-canvas-role="lore-character-v11"
      data-lore-kind="character"
      data-lore-variant="v11"
      style={
        {
          width: 340,
          "--entity-width": "340px",
          boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
        } as CSSProperties
      }
    >
      <input
        ref={portraitFileRef}
        type="file"
        accept="image/*"
        className={labStyles.visuallyHidden}
        aria-hidden
        tabIndex={-1}
        onChange={onPortraitFile}
      />
      {/* Lab-only static HTML; uses canvas `nodeBody` + `loreCharacterBody` (same as production character v11). */}
      <div
        ref={labBodyRef}
        className={cx(canvasStyles.nodeBody, canvasStyles.loreCharacterBody, labStyles.labSkeuoBleed)}
        dangerouslySetInnerHTML={{ __html: displayHtml }}
      />
    </div>
  );
}

function useLabImagePick() {
  const inputRef = useRef<HTMLInputElement>(null);
  const onFile = useCallback((event: ChangeEvent<HTMLInputElement>, onDataUrl: (url: string) => void) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => onDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }, []);
  return { inputRef, onFile };
}

/** Lab-only: V3 survey tag; optional hero image shows the image-swap path. */
function LabLocationV3SurveyTagPreview() {
  const [hero, setHero] = useState<string | null>(null);
  const { inputRef, onFile } = useLabImagePick();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={labStyles.visuallyHidden}
        aria-hidden
        tabIndex={-1}
        onChange={(e) => onFile(e, setHero)}
      />
      <LabCard headerTitle="Location" tapeVariant="dark" tapeRotation={0.8}>
        <div
          data-hg-canvas-role="lore-location"
          data-hg-lore-location-variant="v3"
          className={labStyles.locSurveyV3Shell}
          data-testid="loc-survey-v3"
        >
          {hero ? (
            <>
              <div
                className={labStyles.locSurveyV3HeroPhoto}
                style={{ backgroundImage: `url(${JSON.stringify(hero)})` } as CSSProperties}
                aria-hidden
              />
              <div className={labStyles.locSurveyV3HeroScrim} aria-hidden />
            </>
          ) : null}
          <div className={labStyles.locSurveyV3Foreground}>
            <div
              className={cardStyles.locPlaqueStrip}
              data-loc-strip={locationStripVariantFromSeed("lab-survey-tag-v3")}
              aria-hidden
            />
            <div
              className={cardStyles.plaqueCorner}
              data-hg-lore-location-field="ref"
              contentEditable={false}
            >
              REF · KFC-DOCK-0847
            </div>
            <div
              className={cx(cardStyles.locHeader, hero ? labStyles.locSurveyV3HeaderOnHero : undefined)}
              contentEditable={false}
            >
              <div
                className={cardStyles.locName}
                data-hg-lore-location-field="name"
                contentEditable={false}
              >
                Old Harbor Kiln No. 4
              </div>
              <div
                className={cardStyles.locMetaLine}
                data-hg-lore-location-optional="true"
                contentEditable={false}
              >
                <span className={cardStyles.locMetaKey}>Nation</span>
                <span data-hg-lore-location-field="context" contentEditable={false}>
                  Kestrel Free City
                </span>
              </div>
              <div
                className={cardStyles.locMetaLine}
                data-hg-lore-location-optional="true"
                contentEditable={false}
              >
                <span className={cardStyles.locMetaKey}>Kind</span>
                <span data-hg-lore-location-field="detail" contentEditable={false}>
                  Warehouse · abandoned ceramic works
                </span>
              </div>
            </div>
            <div
              className={cardStyles.notesBlock}
              data-hg-lore-location-notes-cell="true"
              contentEditable={false}
            >
              <span className={cardStyles.fieldLabel}>Notes</span>
              <div
                className={cardStyles.notesText}
                data-hg-lore-location-notes="true"
                contentEditable={false}
              >
                <p>
                  Thin strip color is stable per item id via <code>data-loc-strip</code> + seed hash; the{" "}
                  <code>ref</code> field is an optional monospace stamp for GMs. Use the buttons under the card to try
                  a hero image: same layering a future cover URL would use (photo, scrim, then type).
                </p>
              </div>
            </div>
          </div>
        </div>
      </LabCard>
      <div className={labStyles.locSurveyV3Chrome}>
        <Button type="button" size="sm" variant="neutral" tone="glass" onClick={() => inputRef.current?.click()}>
          {hero ? "Replace hero image" : "Add hero image"}
        </Button>
        {hero ? (
          <Button type="button" size="sm" variant="neutral" tone="glass" onClick={() => setHero(null)}>
            Clear hero
          </Button>
        ) : null}
      </div>
    </>
  );
}

function ThemeToolbar() {
  const { preference, setPreference } = useVigilThemeContext();
  return (
    <div className={labStyles.themeRow} role="group" aria-label="Color scheme">
      <span className={labStyles.themeLabel}>Theme</span>
      {(["light", "dark", "system"] as const).map((key) => (
        <Button
          key={key}
          type="button"
          size="sm"
          variant="neutral"
          tone="glass"
          isActive={preference === key}
          className={labStyles.themeBtn}
          onClick={() => setPreference(key)}
        >
          {key}
        </Button>
      ))}
    </div>
  );
}

function LoreEntityNodeLabInner() {
  return (
    <div className={labStyles.page}>
      <header className={labStyles.topBar}>
        <div className={labStyles.titleBlock}>
          <h1>Lore entity nodes</h1>
          <p>
            Design lab: character ID plate (same v11 seed as the canvas), faction letterhead, and
            location site cards. Same node shell as production; bodies mirror seeded HTML templates.
          </p>
        </div>
        <ThemeToolbar />
      </header>

      <div className={labStyles.sections}>
        <section aria-labelledby="sec-character">
          <h2 id="sec-character" className={labStyles.sectionTitle}>
            Character
          </h2>
          <p className={labStyles.sectionHint}>
            Production template: <code>loreCard: {"{"} kind: &quot;character&quot;, variant: &quot;v11&quot; {"}"}</code>
            , seeded from <code>getLoreNodeSeedBodyHtml</code>. No canvas tape on character nodes; portrait uses the
            same media-root + Upload path as image entities.
          </p>
          <div className={labStyles.grid}>
            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>Character · v11 ID plate</span>
              <LabSkeuoCard html={getLoreNodeSeedBodyHtml("character", "v11")} />
              <ul className={labStyles.spec}>
                <li>
                  <code>charSkShellV11</code> guest-check placeholders (<code>data-hg-lore-ph</code> + marker strokes).
                  Affiliation and nationality stay inline until structured fields land.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="sec-faction">
          <h2 id="sec-faction" className={labStyles.sectionTitle}>
            Faction · org · company
          </h2>
          <p className={labStyles.sectionHint}>
            Twelve <code>FactionLabPlate</code> specimens — no canvas <code>LabCard</code> stack (no tape, no{" "}
            <code>a4DocumentBody</code>). I–III: dead-drop slip, summit stub, interoffice memo. IV–V: same rosy shelf
            catalog; V adds left-edge <code>mask-image</code> perforation + dashed border only. VI: ORDO LUNARIS
            compact (system-sized). VII: full ORDO protocol sheet. VIII: Silent Synod classified sheet. IX: Archive-091
            void document (dark field, rails, letterhead + protocol, metrics table; CSS grain only). X: Lattice induction
            (white protocol sheet, mono meta tags, data grid, static split footer; CSS scanlines; no external images).
            XI: AEON Conclave terminal (pale field, crimson accent; classified header, letterhead, meta rail + body;
            static figure orbs; no live clock / pointer motion). XII: AEON Protocol classified (concrete field, red/mint
            aura, noise grain, crosshairs, 2×2 data grid; all static — no scrub invert / pointer parallax).
          </p>
          <div className={labStyles.grid}>
            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>I · Dead-drop slip</span>
              <FactionLabPlate plateKind="slip">
                <div className={labStyles.facSlipEdge} aria-hidden>
                  WORKING
                </div>
                <div className={labStyles.facSlipMain} data-testid="fac-sheet-docket">
                  <div className={labStyles.facSlipHoles} aria-hidden>
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className={labStyles.facSlipMeta}>
                    <span>LOT 7 · ORG-7741</span>
                    <span className={labStyles.facSlipHot}>OPEN CHANNEL</span>
                  </div>
                  <div className={labStyles.facSlipOrg}>Ironwood Mercantile Exchange</div>
                  <div className={labStyles.facSlipNation}>Obsidian Reach</div>
                  <ul className={labStyles.facSlipTeletype}>
                    <li>Clear customs window · 48h</li>
                    <li>East docks liaison only</li>
                    <li>No ledger signatures until seal</li>
                  </ul>
                </div>
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Vertical margin + binder holes + teletype lines — payload is procedural lines, not a document block.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>II · Summit stub</span>
              <FactionLabPlate plateKind="stub">
                <div className={labStyles.facStubRoot} data-testid="fac-sheet-buff">
                  <div className={labStyles.facStubEyebrow}>Charter summit · admit</div>
                  <div className={labStyles.facStubOrg}>Ironwood Mercantile Exchange</div>
                  <div className={labStyles.facStubNation}>Obsidian Reach</div>
                  <div className={labStyles.facStubPerf} aria-hidden />
                  <div className={labStyles.facStubAgenda}>
                    <div className={labStyles.facStubAgendaTitle}>Floor</div>
                    <ul>
                      <li>Quorum &amp; customs carve-out</li>
                      <li>Harbor tariff pilot vote</li>
                      <li>Adjourn · sealed minutes</li>
                    </ul>
                  </div>
                  <div className={labStyles.facStubTear}>
                    <span className={labStyles.facStubTearCode}>ADM-09-K</span>
                    <span className={labStyles.facStubTearHint}>tear along perf</span>
                  </div>
                </div>
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>Ticket IA: eyebrow, agenda list, perforated tear row with stub code — not a document lane.</li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>III · Interoffice memo</span>
              <FactionLabPlate plateKind="iomemo">
                <div className={labStyles.facMemoRoot} data-testid="fac-lab-iomemo">
                  <div className={labStyles.facMemoMark}>Memorandum</div>
                  <div className={labStyles.facMemoField}>
                    <span className={labStyles.facMemoLabel}>To</span>
                    <span className={labStyles.facMemoVal}>Obsidian Reach · charter window</span>
                  </div>
                  <div className={labStyles.facMemoField}>
                    <span className={labStyles.facMemoLabel}>From</span>
                    <span className={labStyles.facMemoVal}>Ironwood Mercantile Exchange</span>
                  </div>
                  <div className={labStyles.facMemoField}>
                    <span className={labStyles.facMemoLabel}>Re</span>
                    <span className={labStyles.facMemoVal}>Harbor tariff pilot · customs carve-out</span>
                  </div>
                  <div className={labStyles.facMemoRule} aria-hidden />
                  <p className={labStyles.facMemoNote}>
                    Distribution: HG registry clerk · file duplicate under ORG-7741. Verbal commitments non-binding.
                  </p>
                </div>
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Memo routing: TO / FROM / RE with ruled field lines — not a summit stub, not perforation or tear copy.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>IV · Shelf · rosy gradient</span>
              <FactionLabPlate plateKind="shelfcard">
                <ArchitecturalNodeHeader
                  title="Faction"
                  expandLabel="Focus Mode"
                  onExpand={() => {}}
                  buttonTone="card-light"
                  compact
                />
                <FactionShelfCardBody testId="fac-lab-shelfcard" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Summit-stub family: deeper <code>accent</code> gradient on the card face — dot-leader catalog IA with
                  compact document header (no edge mask).
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V · Shelf · sleeve perforation</span>
              <FactionLabPlate plateKind="shelfcardSleeve">
                <div className={labStyles.facShelfSleeveStack}>
                  <ArchitecturalNodeHeader
                    title="Faction"
                    expandLabel="Focus Mode"
                    onExpand={() => {}}
                    buttonTone="card-light"
                    compact
                  />
                  <FactionShelfCardBody testId="fac-lab-shelfcard-sleeve" />
                </div>
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Same rosy gradient as IV; dashed border on the shell. Holes: <code>mask-image</code> on the outer{" "}
                  <code>factionLabPlate_shelfcardSleeve</code> (full paint + gradient) so notches read against the lab
                  page; <code>facShelfSleeveStack</code> is layout-only; vertical padding + <code>mask-clip</code>:{" "}
                  content-box insets the repeat.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>VI · Protocol · ORDO LUNARIS · compact</span>
              <FactionLabPlate plateKind="protocolOrdoCompact">
                <FactionProtocolOrdoCompactBody testId="fac-lab-protocol-ordo-compact" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Same warm concrete + coral chrome as VII, scaled for the node width: single decree, one-line meta,
                  short footer; type sized for legibility on 340px (mono meta ~8px, body ~10.5px) — no scroll.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>VII · Protocol · ORDO LUNARIS</span>
              <FactionLabPlate plateKind="protocolOrdo">
                <FactionProtocolOrdoBody testId="fac-lab-protocol-ordo" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Full protocol layout (decrees I–II, margin boxes, footer strip); static multiply glow; no pointer
                  tracking. Plate uses overflow hidden — no internal scrollbars.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>VIII · Classified · Silent Synod</span>
              <FactionLabPlate plateKind="protocolSynod">
                <FactionSilentSynodBody testId="fac-lab-protocol-synod" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Legible brief: cream field + blood accent; large title + ref column, lead line, two fact cells,
                  standing order, footer + OMEGA stamp. Denser dossier / sigil / pillar list removed so type stays
                  readable on 340px.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>IX · Archive · 091 internal</span>
              <FactionLabPlate plateKind="protocolArchive091">
                <FactionArchive091Body testId="fac-lab-protocol-archive-091" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Dark void archive: side rails + star sigils, meta strip with blink, Playfair letterhead, protocol +
                  metrics table, pill tags, ritual line (non-interactive). Arch centerpiece removed for vertical space.
                  CSS noise grain; no canvas / pointer parallax.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>X · Protocol · Lattice induction</span>
              <FactionLabPlate plateKind="protocolLattice">
                <FactionLatticeInductionBody testId="fac-lab-protocol-lattice" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Legible notice: masthead + ~11px body, row-based stats (no micro three-up grid), one obligation line,
                  taller footer copy (~8px mono). Lighter scanlines; avatar + coord strip omitted for space.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>XI · Terminal · AEON Conclave</span>
              <FactionLabPlate plateKind="protocolAeonConclave">
                <FactionAeonConclaveBody testId="fac-lab-protocol-aeon-conclave" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Reference: TERMINAL // AEON-9 — pale field, ink + crimson accent, Geist Mono rails; classified header,
                  stacked letterhead, sticky-style meta column + numbered paragraphs, static black insert with concentric
                  orbs (no animation / no pointer FX), signature + seal. Floating action omitted; type scaled for 340px
                  legibility.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>XII · Protocol · AEON classified</span>
              <FactionLabPlate plateKind="protocolAeonProtocol">
                <FactionAeonProtocolClassifiedBody testId="fac-lab-protocol-aeon-protocol" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Reference: THE AEON PROTOCOL // CLASSIFIED — warm concrete, red + mint aura, SVG grain overlay,
                  corner crosshairs, index + header stack, subject rule with marker, ~11px body, legible 2×2 grid, stamp +
                  registry, static CTA strip (no invert / no hover redact).
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="sec-location">
          <h2 id="sec-location" className={labStyles.sectionTitle}>
            Location
          </h2>
          <p className={labStyles.sectionHint}>
            Same <code>bodyHtml</code> contract as seeded canvas nodes:{" "}
            <code>data-hg-canvas-role=&quot;lore-location&quot;</code> +{" "}
            <code>data-hg-lore-location-variant</code>, fields <code>name</code> / <code>context</code> /{" "}
            <code>detail</code>, optional <code>ref</code> on v3, and notes in{" "}
            <code>data-hg-lore-location-notes-cell</code>. Previews use sample copy; production seeds live in{" "}
            <code>getLoreNodeSeedBodyHtml(&quot;location&quot;, …)</code>.{" "}
            V4 is a lab-only grayscale ORDO coordinate slab (<code>protocolOrdoCompactMono</code>) — static specimen. V5
            is a dense field-mapped slab (extra header + stamp fiction). V6 is lean with legacy rich HTML in one surface;
            V7 matches that layout but uses <code>HeartgardenDocEditor</code> (hgDoc) for <strong>notes</strong> only.
            Vector search still indexes whatever lands in <code>items.contentText</code> (see{" "}
            <code>buildVaultEmbedDocument</code> in <code>vault-chunk.ts</code>), not separate LAT/ELV/etc. columns.
          </p>
          <div className={labStyles.grid}>
            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V2 · Postcard band</span>
              <LabCard headerTitle="Location" tapeVariant="clear" tapeRotation={-2}>
                <div data-hg-canvas-role="lore-location" data-hg-lore-location-variant="v2">
                  <div className={cardStyles.postcardBand} aria-hidden />
                  <div className={cardStyles.locHeader} contentEditable={false}>
                    <div
                      className={cardStyles.locName}
                      data-hg-lore-location-field="name"
                      contentEditable={false}
                    >
                      Old Harbor Kiln No. 4
                    </div>
                    <div
                      className={cardStyles.locMetaLine}
                      data-hg-lore-location-optional="true"
                      contentEditable={false}
                    >
                      <span data-hg-lore-location-field="context" contentEditable={false}>
                        Kestrel Free City
                      </span>
                    </div>
                    <div
                      className={cardStyles.locMetaLine}
                      data-hg-lore-location-optional="true"
                      contentEditable={false}
                    >
                      <span className={cardStyles.locMetaKey}>Detail</span>
                      <span data-hg-lore-location-field="detail" contentEditable={false}>
                        Dock ward · industrial brick
                      </span>
                    </div>
                  </div>
                  <div
                    className={cardStyles.notesBlock}
                    data-hg-lore-location-notes-cell="true"
                    contentEditable={false}
                  >
                    <span className={cardStyles.fieldLabel}>Notes</span>
                    <div
                      className={cardStyles.notesText}
                      data-hg-lore-location-notes="true"
                      contentEditable={false}
                    >
                      <p>
                        Color band suggests landscape / atmosphere without an image asset. Strip uses the
                        same full-bleed inset as the v3 survey bar.
                      </p>
                    </div>
                  </div>
                </div>
              </LabCard>
              <ul className={labStyles.spec}>
                <li>
                  <code>v2</code> seed: optional <code>context</code> line without a key (reads as subtitle).
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V3 · Survey tag</span>
              <LabLocationV3SurveyTagPreview />
              <ul className={labStyles.spec}>
                <li>
                  <code>v3</code> seed order: strip → <code>ref</code> → header → notes (matches{" "}
                  <code>lore-node-seed-html</code>).
                </li>
                <li>Optional hero image in this lab only — canvas seeds stay HTML + strip until a cover field exists.</li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V4 · Ordo · coordinate slab (mono)</span>
              <FactionLabPlate plateKind="protocolOrdoCompactMono">
                <FactionProtocolOrdoCompactBody testId="loc-lab-ordo-coordinate-mono" brandLabel="LOCATION" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Grayscale ORDO LUNARIS compact plate moved here as a location-oriented preview: clearance, live clock,
                  and LAT/LON in the header rail, charter copy below. Same <code>FactionLabPlate</code> width as faction
                  specimens; not wired to <code>lore-location</code> HTML until product adopts this IA.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V5 · Ordo · coordinate slab (mono, field-mapped)</span>
              <FactionLabPlate plateKind="protocolOrdoCompactMono">
                <LocationOrdoCoordinateSlabV5Body testId="loc-lab-ordo-coordinate-mono-v5" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Same chrome as V4, but the slab is a real <code>lore-location</code> shape: masthead reads{" "}
                  <code>LOCATION</code> (mono, like V4); <code>ref</code> / <code>context</code> in the two-line stamp;
                  <code>name</code> drives the grotesk stack; <code>context</code> also drives the footer strip;{" "}
                  <code>detail</code> as a secondary line; notes sit inline in the column (no extra panel) with the same Geist
                  / line-height rhythm as canvas <code>nodeBody</code> / hgDoc prose. LAT/LON are deterministic from the
                  ref (lab only).
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V6 · Ordo · coordinate slab (mono, lean)</span>
              <FactionLabPlate plateKind="protocolOrdoCompactMono">
                <LocationOrdoCoordinateSlabV6Body testId="loc-lab-ordo-coordinate-mono-v6" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Same plate as V4–V5; DOM carries only <code>name</code>, <code>context</code>, <code>detail</code>,{" "}
                  <code>ref</code>, <code>notes</code> — no duplicate stamps, charter/LAT/survey lines, or footer grid.
                  The slab body uses <code>BufferedContentEditable</code> (rich HTML like canvas nodes); no header REF
                  rail. Search indexing uses the item&apos;s text blob + title, not per-field keys.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V7 · Ordo · coordinate slab (mono, hgDoc notes)</span>
              <FactionLabPlate plateKind="protocolOrdoCompactMono">
                <LocationOrdoCoordinateSlabV7Body testId="loc-lab-ordo-coordinate-mono-v7" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Same lean slab as V6 (structured <code>name</code> / <code>context</code> / <code>detail</code> + footer
                  ref), but <code>notes</code> use <code>HeartgardenDocEditor</code> — TipTap hgDoc (slash menu, block
                  schema) with V6-matched Geist sizing on the plate.
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function LoreEntityNodeLab() {
  return (
    <VigilThemeProvider>
      <LoreEntityNodeLabInner />
    </VigilThemeProvider>
  );
}
