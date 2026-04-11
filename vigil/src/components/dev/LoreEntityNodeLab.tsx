"use client";

/**
 * Lore entity node design lab. Previews are static HTML; production wiring can use
 * `items.entity_type` (character | faction | location) plus optional `content_json.hgArch`
 * keys such as `cardVariant` once a direction is chosen.
 *
 * **Body vs document shell:** Character v11 and “Location lab skins” use a **body-only canvas plate**
 * (`LabSkeuoCard` / `LabLocationConceptPlate`) — same stack as character lab (`data-lore-chrome="skeuo"`, zero-pad
 * `nodeBody` + `loreCharacterBody` + `labSkeuoBleed`), no tape/header and no extra `a4DocumentBody` sheet.
 * Faction + seeded location v1–v3 use **`LabCard`** (tape + header + `a4DocumentBody`) to match A4 lore nodes on canvas.
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

/** High-concept location lab bodies only (not seeded card IA). */
type LabLocationConceptId = "survey" | "departures" | "polaroid";

/**
 * Body plate for **overhauled** location concepts — same outer stack as `LabSkeuoCard` (no tape/header).
 * Children are free-form layout (not `locName` / `locMetaLine` document stacks).
 */
function LabLocationConceptPlate({
  concept,
  testId,
  children,
}: {
  concept: LabLocationConceptId;
  testId: string;
  children: ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className={cx(canvasStyles.entityNode, canvasStyles.themeDefault, labStyles.locLabSkinPlate)}
      data-lore-chrome="skeuo"
      data-hg-heartgarden-lab-location-concept={concept}
      data-lore-kind="location"
      data-lore-variant="lab-visual-exploration"
      style={
        {
          width: 340,
          "--entity-width": "340px",
        } as CSSProperties
      }
    >
      <div
        className={cx(
          canvasStyles.nodeBody,
          canvasStyles.loreCharacterBody,
          labStyles.labSkeuoBleed,
          labStyles.locLabSkinBodyFlush,
        )}
      >
        {children}
      </div>
    </div>
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
            Letterhead vocabulary: versatile for guilds, corps, cults, or governments. Only
            essentials in the header—name and nation—then the rest is a normal document.
          </p>
          <div className={labStyles.grid}>
            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V1 · Classic letterhead</span>
              <LabCard headerTitle="Organization" tapeVariant="clear" tapeRotation={-1.8}>
                <div className={cardStyles.letterheadCenter}>
                  <div className={cardStyles.letterheadMark} aria-hidden />
                  <div className={cardStyles.orgName}>Ironwood Mercantile Exchange</div>
                  <div className={cardStyles.orgRule} />
                  <div className={cardStyles.nationLine}>Obsidian Reach</div>
                </div>
                <div className={cardStyles.notesBlock}>
                  <span className={cardStyles.fieldLabel}>Document</span>
                  <p className={cardStyles.notesText}>
                    Charter, public face, front companies, or internal drama—keep it unstructured
                    here so imports and future schemas stay flexible.
                  </p>
                </div>
              </LabCard>
              <ul className={labStyles.spec}>
                <li>Mark is CSS-only; swap for uploaded crest when you wire media.</li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V2 · Monogram rail</span>
              <LabCard headerTitle="Organization" tapeVariant="masking" tapeRotation={2}>
                <div className={cardStyles.letterheadAsym}>
                  <div className={cardStyles.monogram} aria-hidden>
                    I
                  </div>
                  <div>
                    <div className={cardStyles.orgName} style={{ textAlign: "left" }}>
                      Ironwood Mercantile Exchange
                    </div>
                    <div className={cardStyles.nationLine} style={{ textAlign: "left", marginTop: 8 }}>
                      Obsidian Reach
                    </div>
                  </div>
                </div>
                <div className={cardStyles.notesBlock}>
                  <span className={cardStyles.fieldLabel}>Document</span>
                  <p className={cardStyles.notesText}>
                    Asymmetric layout reads as stationery without heavy ornament—still reusable
                    across faction types.
                  </p>
                </div>
              </LabCard>
              <ul className={labStyles.spec}>
                <li>Monogram = first letter of name; could be derived from title in code later.</li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V3 · Framed memorandum</span>
              <LabCard headerTitle="Organization" tapeVariant="clear" tapeRotation={-0.5}>
                <div className={cardStyles.letterheadFrame}>
                  <div className={cardStyles.orgName}>Ironwood Mercantile Exchange</div>
                  <div className={cardStyles.nationLine} style={{ marginTop: 10 }}>
                    Obsidian Reach
                  </div>
                </div>
                <div className={cardStyles.notesBlock}>
                  <span className={cardStyles.fieldLabel}>Document</span>
                  <p className={cardStyles.notesText}>
                    Double-line frame adds weight while staying typographic—good for formal bodies
                    or megacorps.
                  </p>
                </div>
              </LabCard>
              <ul className={labStyles.spec}>
                <li>Subtle inner highlight keeps it from feeling flat on dark mode.</li>
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
              <span className={labStyles.variantLabel}>V1 · Site plaque</span>
              <LabCard headerTitle="Location" tapeVariant="masking" tapeRotation={1.5}>
                <div data-hg-canvas-role="lore-location" data-hg-lore-location-variant="v1">
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
                      <span className={cardStyles.locMetaKey}>Site</span>
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
                        Rumored meeting spot for the Exchange. Labels are presentation—swap “Site”
                        for “Region”, “Floor”, “Dungeon level”, etc.
                      </p>
                    </div>
                  </div>
                </div>
              </LabCard>
              <ul className={labStyles.spec}>
                <li>
                  <code>v1</code> seed: labeled <code>context</code> + <code>detail</code> lines under serif{" "}
                  <code>name</code>.
                </li>
              </ul>
            </div>

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
              <LabCard headerTitle="Location" tapeVariant="dark" tapeRotation={0.8}>
                <div data-hg-canvas-role="lore-location" data-hg-lore-location-variant="v3">
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
                        Thin strip color is stable per item id via <code>data-loc-strip</code> + seed hash;
                        the <code>ref</code> field is an optional monospace stamp for GMs.
                      </p>
                    </div>
                  </div>
                </div>
              </LabCard>
              <ul className={labStyles.spec}>
                <li>
                  <code>v3</code> seed order: strip → <code>ref</code> → header → notes (matches{" "}
                  <code>lore-node-seed-html</code>).
                </li>
              </ul>
            </div>
          </div>

          <h3 id="sec-location-lab-skins" className={labStyles.subsectionTitle}>
            Location · high-concept lab
          </h3>
          <p className={labStyles.sectionHint}>
            Three <strong>different information architectures</strong> (this page only)—not another pass at the
            document-lore “title + labeled lines + notes” card. Same eventual field contract can still back them; the
            point here is <strong>spatial metaphor</strong> (survey sheet, departures board, polaroid).
          </p>
          <div className={labStyles.grid}>
            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>LAB · Survey datum sheet</span>
              <LabLocationConceptPlate concept="survey" testId="loc-lab-concept-survey">
                <div className={labStyles.locLabConceptSurveyRoot}>
                  <div className={labStyles.locLabConceptSurveyShell}>
                    <aside className={labStyles.locLabConceptSurveyRail} aria-label="Survey marginalia">
                      <span className={labStyles.locLabConceptSurveyRailText}>
                        OBS GLASS · TRV-Q9 · REV AS-BUILT
                      </span>
                    </aside>
                    <div className={labStyles.locLabConceptSurveyMain}>
                      <div className={labStyles.locLabConceptSurveyStamp}>Revised as-built</div>
                      <div className={labStyles.locLabConceptSurveyStencil}>OBQ-CRY-B</div>
                      <div className={labStyles.locLabConceptSurveySubtitle}>
                        Oblique cistern · pressure collar (dive envelope)
                      </div>
                      <div className={labStyles.locLabConceptSurveyGrid}>
                        <div className={labStyles.locLabConceptSurveyCell}>
                          <span className={labStyles.locLabConceptSurveyCellLab}>Depth datum</span>
                          <span className={labStyles.locLabConceptSurveyCellVal}>−42 m sill</span>
                        </div>
                        <div className={labStyles.locLabConceptSurveyCell}>
                          <span className={labStyles.locLabConceptSurveyCellLab}>Bearing</span>
                          <span className={labStyles.locLabConceptSurveyCellVal}>118° mag</span>
                        </div>
                        <div className={labStyles.locLabConceptSurveyCell}>
                          <span className={labStyles.locLabConceptSurveyCellLab}>Phase</span>
                          <span className={labStyles.locLabConceptSurveyCellVal}>IV — voided</span>
                        </div>
                        <div className={labStyles.locLabConceptSurveyCell}>
                          <span className={labStyles.locLabConceptSurveyCellLab}>Witness</span>
                          <span className={labStyles.locLabConceptSurveyCellVal}>H. Vellum / 09</span>
                        </div>
                      </div>
                      <div className={labStyles.locLabConceptSurveyRuler} aria-hidden />
                      <p className={labStyles.locLabConceptSurveyFoot}>
                        Margin rail + stencil code + 2×2 datum grid — not the seeded location header stack.
                      </p>
                    </div>
                  </div>
                </div>
              </LabLocationConceptPlate>
              <ul className={labStyles.spec}>
                <li>Survey sheet metaphor: drafting grid, registration ticks, engineer ruler strip.</li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>LAB · Night departures board</span>
              <LabLocationConceptPlate concept="departures" testId="loc-lab-concept-departures">
                <div className={labStyles.locLabConceptDepartRoot}>
                  <div className={labStyles.locLabConceptDepartBrand}>Glassway interchange · night board</div>
                  <div className={labStyles.locLabConceptDepartHead}>
                    <span>Line</span>
                    <span>Toward</span>
                    <span>State</span>
                  </div>
                  <div className={labStyles.locLabConceptDepartRow}>
                    <span className={labStyles.locLabConceptDepartLine}>Salt spine express</span>
                    <span className={labStyles.locLabConceptDepartToward}>Mirage well · stall 6</span>
                    <span className={labStyles.locLabConceptDepartStateLive}>live</span>
                  </div>
                  <div className={labStyles.locLabConceptDepartRow}>
                    <span className={labStyles.locLabConceptDepartLine}>Glass choir local</span>
                    <span className={labStyles.locLabConceptDepartToward}>Courtyard thread · seal lit</span>
                    <span className={labStyles.locLabConceptDepartStateDelay}>delay</span>
                  </div>
                  <div className={labStyles.locLabConceptDepartRow}>
                    <span className={labStyles.locLabConceptDepartLine}>Crown liturgy shuttle</span>
                    <span className={labStyles.locLabConceptDepartToward}>Sealed wing · vestry</span>
                    <span className={labStyles.locLabConceptDepartStateLive}>live</span>
                  </div>
                  <p className={labStyles.locLabConceptDepartFoot}>
                    LED / split-flap IA: three-column rows — not serif title + meta lines.
                  </p>
                </div>
              </LabLocationConceptPlate>
              <ul className={labStyles.spec}>
                <li>Transit board metaphor: phosphor mono on near-black slab.</li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>LAB · Polaroid caption stub</span>
              <LabLocationConceptPlate concept="polaroid" testId="loc-lab-concept-polaroid">
                <div className={labStyles.locLabConceptPolaroidRoot}>
                  <div className={labStyles.locLabConceptPolaroidPerf} aria-hidden />
                  <div className={labStyles.locLabConceptPolaroidFrame}>
                    <div className={labStyles.locLabConceptPolaroidFilm} aria-hidden />
                    <div className={labStyles.locLabConceptPolaroidMeta}>
                      <span className={labStyles.locLabConceptPolaroidStamp}>HG-LOC-LAB</span>
                      <span className={labStyles.locLabConceptPolaroidDate}>Apr · fog roll 04:12</span>
                    </div>
                    <p className={labStyles.locLabConceptPolaroidCaption}>
                      “We only ever saw the courtyard from this angle once — then the thread closed.”
                    </p>
                  </div>
                  <p className={labStyles.locLabConceptPolaroidFoot}>
                    Hero well + thick caption margin: memory-shard layout, not A4 prose blocks.
                  </p>
                </div>
              </LabLocationConceptPlate>
              <ul className={labStyles.spec}>
                <li>Polaroid metaphor: perforation, instant-film well, stamp + handwriting caption.</li>
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
