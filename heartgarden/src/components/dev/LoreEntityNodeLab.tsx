"use client";

/**
 * Lore entity node design lab. Previews are static HTML; production wiring can use
 * `items.entity_type` (character | faction | location) plus optional `content_json.hgArch`
 * keys such as `cardVariant` once a direction is chosen.
 *
 * **Body vs document shell:** Character v11 uses **`LabSkeuoCard`** (body-only canvas plate; same stack as production).
 * Faction lab previews use **`FactionLabPlate`** (lab-only chrome) — not **`LabCard`**, so they are not constrained to
 * tape + `ArchitecturalNodeHeader` + `a4DocumentBody`. Location v2–v3 still use **`LabCard`** to match canvas A4 nodes.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  ArchitecturalNodeHeader,
  ArchitecturalNodeTape,
} from "@/src/components/foundation/ArchitecturalNodeCard";
import canvasStyles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import cardStyles from "@/src/components/foundation/lore-entity-card.module.css";
import { VigilThemeProvider, useVigilThemeContext } from "@/src/contexts/vigil-theme-context";
import { cx } from "@/src/lib/cx";
import type { TapeVariant } from "@/src/components/foundation/architectural-types";
import { Button } from "@/src/components/ui/Button";

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
    | "nameplate"
    | "stub"
    | "carboncopy"
    | "iomemo"
    | "shelfcard"
    | "luggagetag"
    | "manilatab"
    | "queuechit";
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
            Nine <code>FactionLabPlate</code> specimens — no canvas <code>LabCard</code> stack (no tape, no node header,
            no <code>a4DocumentBody</code>). Rows one–two: slip, plate, stub; carbon duplicate sheet, memo, shelf card.
            Row three: paper-forward props — luggage tag (hole + cut), manila folder tab, queue chit (perf + thermal
            number).
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
              <span className={labStyles.variantLabel}>II · Rating plate</span>
              <FactionLabPlate plateKind="nameplate">
                <div className={labStyles.facPlateFrame} data-testid="fac-sheet-ember">
                  <span className={labStyles.facPlateRivet} aria-hidden />
                  <span className={labStyles.facPlateRivet} aria-hidden />
                  <span className={labStyles.facPlateRivet} aria-hidden />
                  <span className={labStyles.facPlateRivet} aria-hidden />
                  <div className={labStyles.facPlateBevel}>HG · FACTION REGISTRY</div>
                  <div className={labStyles.facPlateOrg}>Ironwood Mercantile Exchange</div>
                  <div className={labStyles.facPlateNation}>Obsidian Reach</div>
                  <div className={labStyles.facPlateSerial}>SN HG-FAC-4412 · REV B</div>
                  <div className={labStyles.facPlateBarcode} aria-hidden />
                </div>
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Low, wide plate: bevel rail, rivets, serial + machine-readable strip — no prose &quot;body&quot;
                  field.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>III · Summit stub</span>
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
              <span className={labStyles.variantLabel}>IV · Carbon copy</span>
              <FactionLabPlate plateKind="carboncopy">
                <div className={labStyles.facCarbRoot} data-testid="fac-lab-carboncopy">
                  <div className={labStyles.facCarbStack}>
                    <div className={labStyles.facCarbUnder} aria-hidden />
                    <div className={labStyles.facCarbSheet}>
                      <div className={labStyles.facCarbFlag}>Carbon copy · retain</div>
                      <div className={labStyles.facCarbOrg}>Ironwood Mercantile Exchange</div>
                      <div className={labStyles.facCarbSub}>Obsidian Reach</div>
                      <div className={labStyles.facCarbPerf} aria-hidden />
                      <div className={labStyles.facCarbFine}>Clerk file · not valid without original</div>
                    </div>
                  </div>
                </div>
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Duplicate-sheet stack: canary layer offset behind the face sheet, perf cue — paper object, not a grid or
                  routing table.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V · Interoffice memo</span>
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
              <span className={labStyles.variantLabel}>VI · Shelf card</span>
              <FactionLabPlate plateKind="shelfcard">
                <div className={labStyles.facShelfRoot} data-testid="fac-lab-shelfcard">
                  <div className={labStyles.facShelfCall}>HG-FAC-4412</div>
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
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Shelf catalog IA: call number block, title, dot-leader attribute lines — not a metal plate, rivets, or
                  barcode strip.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>VII · Luggage tag</span>
              <FactionLabPlate plateKind="luggagetag">
                <div className={labStyles.facTagRoot} data-testid="fac-lab-luggagetag">
                  <div className={labStyles.facTagCard}>
                    <div className={labStyles.facTagHole} aria-hidden>
                      <span className={labStyles.facTagHoleRing} />
                    </div>
                    <div className={labStyles.facTagDest}>OBS</div>
                    <div className={labStyles.facTagRoute}>E-04 · ORG-7741</div>
                    <div className={labStyles.facTagOrg}>Ironwood Mercantile Exchange</div>
                  </div>
                </div>
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Baggage-tag silhouette: reinforced hole, pointed stock, stamped routing — reads as strung cardboard,
                  not a generic strip.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>VIII · Manila tab</span>
              <FactionLabPlate plateKind="manilatab">
                <div className={labStyles.facFolderRoot} data-testid="fac-lab-manilatab">
                  <div className={labStyles.facFolderTab}>ORG-7741</div>
                  <div className={labStyles.facFolderBody}>
                    <div className={labStyles.facFolderTitle}>Ironwood Mercantile Exchange</div>
                    <div className={labStyles.facFolderMeta}>Charter · pending file</div>
                  </div>
                </div>
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>Folder IA: manila stock + cut tab with label — physical filing, not centered type on a dark field.</li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>IX · Queue chit</span>
              <FactionLabPlate plateKind="queuechit">
                <div className={labStyles.facQRoot} data-testid="fac-lab-queuechit">
                  <div className={labStyles.facQPerf} aria-hidden />
                  <div className={labStyles.facQNum}>084</div>
                  <div className={labStyles.facQLabel}>Ironwood Mercantile Exchange</div>
                  <div className={labStyles.facQFine}>Now serving · keep this chit</div>
                </div>
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>Thermal queue ticket: torn perf edge, oversized number, receipt grain — not a pill badge.</li>
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
            <code>getLoreNodeSeedBodyHtml(&quot;location&quot;, …)</code>.
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
