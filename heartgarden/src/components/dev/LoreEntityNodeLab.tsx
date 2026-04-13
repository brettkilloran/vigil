"use client";

/**
 * Lore entity node design lab. Previews are static HTML; production wiring can use
 * `items.entity_type` (character | faction | location) plus optional `content_json.hgArch`
 * keys such as `cardVariant` once a direction is chosen.
 *
 * **Body vs document shell:** Character v11 and “Location lab skins” use a **body-only canvas plate**
 * (`LabSkeuoCard` / `LabLocationSkinPlate`) — same stack as character lab (`data-lore-chrome="skeuo"`, zero-pad
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

type LabLocationSkinId = "blueprint" | "waypoint" | "deed";

/**
 * Location visual explorations only: match `LabSkeuoCard` shell exactly —
 * `entityNode` + `themeDefault` + `data-lore-chrome="skeuo"` (transparent plate, no faux document sheet),
 * inner `nodeBody` + `loreCharacterBody` + `labSkeuoBleed` (zero body padding, no `a4DocumentBody` mask/scroll).
 */
function LabLocationSkinPlate({
  skin,
  testId,
  children,
}: {
  skin: LabLocationSkinId;
  testId: string;
  children: ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className={cx(canvasStyles.entityNode, canvasStyles.themeDefault, labStyles.locLabSkinPlate)}
      data-lore-chrome="skeuo"
      data-hg-heartgarden-lab-location-skin={skin}
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

type LabLocationConceptId = "polaroid" | "poster" | "specimen";

/** High-concept location lab row: same skeuo body shell as skins, separate shell chrome + `data-hg-heartgarden-lab-location-concept`. */
function LabLocationConceptPlate({
  conceptId,
  testId,
  children,
}: {
  conceptId: LabLocationConceptId;
  testId: string;
  children: ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className={cx(canvasStyles.entityNode, canvasStyles.themeDefault, labStyles.locConceptShell)}
      data-lore-chrome="skeuo"
      data-hg-heartgarden-lab-location-concept={conceptId}
      data-lore-kind="location"
      data-lore-variant="lab-concept-next"
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

function LabLocationConceptPolaroid({ testId }: { testId: string }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const { inputRef, onFile } = useLabImagePick();

  return (
    <LabLocationConceptPlate conceptId="polaroid" testId={testId}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={labStyles.visuallyHidden}
        aria-hidden
        tabIndex={-1}
        onChange={(e) => onFile(e, setPhoto)}
      />
      <div className={labStyles.locConceptPolaroidOuter}>
        <div className={labStyles.locConceptPolaroidFrame}>
          <Button
            type="button"
            variant="ghost"
            className={labStyles.locConceptPolaroidWell}
            onClick={() => inputRef.current?.click()}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- lab data URL preview
              <img src={photo} alt="Field photograph" className={labStyles.locConceptPolaroidImg} />
            ) : (
              <span className={labStyles.locConceptPolaroidPlaceholder}>Click to add field photograph</span>
            )}
          </Button>
          <p className={labStyles.locConceptPolaroidCaption}>Blackwater hinge — tide took the pier in one night.</p>
        </div>
        <div className={labStyles.locConceptPolaroidChin}>
          <span className={labStyles.locConceptPolaroidStamp}>BRINE 17 · AUG 04</span>
          <Button type="button" size="sm" variant="neutral" tone="glass" onClick={() => inputRef.current?.click()}>
            {photo ? "Replace photo" : "Upload photo"}
          </Button>
        </div>
      </div>
    </LabLocationConceptPlate>
  );
}

function LabLocationConceptPoster({ testId }: { testId: string }) {
  const [backdrop, setBackdrop] = useState<string | null>(null);
  const { inputRef, onFile } = useLabImagePick();

  return (
    <LabLocationConceptPlate conceptId="poster" testId={testId}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={labStyles.visuallyHidden}
        aria-hidden
        tabIndex={-1}
        onChange={(e) => onFile(e, setBackdrop)}
      />
      <div className={cx(labStyles.locConceptPosterRoot, backdrop && labStyles.locConceptPosterRootHasPhoto)}>
        {backdrop ? (
          <div
            className={labStyles.locConceptPosterPhoto}
            style={{ backgroundImage: `url(${backdrop})` } as CSSProperties}
            aria-hidden
          />
        ) : null}
        <div className={labStyles.locConceptPosterScrim} aria-hidden />
        <div className={labStyles.locConceptPosterBody}>
          <p className={labStyles.locConceptPosterEyebrow}>Night-line terminus</p>
          <p className={labStyles.locConceptPosterTitle}>Stations of the last warm current</p>
          <p className={labStyles.locConceptPosterLead}>
            Poster-scale type + optional billboard backdrop — not a letterhead, not a plaque meta stack.
          </p>
        </div>
        <div className={labStyles.locConceptPosterActions}>
          <Button type="button" size="sm" variant="neutral" tone="glass" onClick={() => inputRef.current?.click()}>
            {backdrop ? "Replace backdrop" : "Add backdrop image"}
          </Button>
        </div>
      </div>
    </LabLocationConceptPlate>
  );
}

function LabLocationConceptSpecimen({ testId }: { testId: string }) {
  const [thumb, setThumb] = useState<string | null>(null);
  const { inputRef, onFile } = useLabImagePick();

  return (
    <LabLocationConceptPlate conceptId="specimen" testId={testId}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={labStyles.visuallyHidden}
        aria-hidden
        tabIndex={-1}
        onChange={(e) => onFile(e, setThumb)}
      />
      <div className={labStyles.locConceptSpecimenRoot}>
        <div className={labStyles.locConceptSpecimenRail} aria-hidden>
          SPECIMEN
          <br />
          HOLD
        </div>
        <Button
          type="button"
          variant="ghost"
          className={labStyles.locConceptSpecimenThumb}
          onClick={() => inputRef.current?.click()}
        >
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="Specimen capture" className={labStyles.locConceptSpecimenImg} />
          ) : (
            <span className={labStyles.locConceptSpecimenThumbLabel}>Thumb image</span>
          )}
        </Button>
        <div className={labStyles.locConceptSpecimenCopy}>
          <div className={labStyles.locConceptSpecimenId}>HG-SPC-09-λ</div>
          <div className={labStyles.locConceptSpecimenTitle}>Glass lung well</div>
          <div className={labStyles.locConceptSpecimenMeta}>Accretion sublevel · vapor class IV · do not vent</div>
          <Button type="button" size="sm" variant="neutral" tone="glass" onClick={() => inputRef.current?.click()}>
            {thumb ? "Replace thumb" : "Upload thumb"}
          </Button>
        </div>
      </div>
    </LabLocationConceptPlate>
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
            Location lab skins
          </h3>
          <p className={labStyles.sectionHint}>
            Three <strong>lab-only</strong> chrome explorations (this route +{" "}
            <code>lore-entity-node-lab.module.css</code> only)—not seeds, not new <code>hgArch</code> types. Shown on the
            same <strong>body plate</strong> as the character row: <code>data-lore-chrome=&quot;skeuo&quot;</code>,{" "}
            <code>nodeBody</code> + <code>loreCharacterBody</code> + <code>labSkeuoBleed</code> (no{" "}
            <code>a4DocumentBody</code> scroll sheet), <em>no</em> tape or “Location” header.
          </p>
          <div className={labStyles.grid}>
            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>LAB · Blueprint site sheet</span>
              <LabLocationSkinPlate skin="blueprint" testId="loc-lab-skin-blueprint">
                <div className={labStyles.locLabSkinBlueRoot}>
                  <div className={labStyles.locLabSkinBlueScale} aria-hidden />
                  <div className={labStyles.locLabSkinTitle}>Oblique Cistern · Access B</div>
                  <div className={labStyles.locLabSkinMetaRow}>
                    <span className={labStyles.locLabSkinMetaKey}>Survey</span>
                    Vashti traverse · fault ribbon Q-9
                  </div>
                  <div className={labStyles.locLabSkinMetaRow}>
                    <span className={labStyles.locLabSkinMetaKey}>Station</span>
                    Pressure collar · two-meter sill (dive-rated)
                  </div>
                  <div className={labStyles.locLabSkinNotesWrap}>
                    <span className={labStyles.locLabSkinNotesLabel}>Notes</span>
                    <p className={labStyles.locLabSkinNotesBody}>
                      Chrome only: grid + scale bar read as “measured ruin” without inventing new stored columns.
                    </p>
                  </div>
                </div>
              </LabLocationSkinPlate>
              <ul className={labStyles.spec}>
                <li>Blueprint: cool paper + accent grid; type uses <code>--sem-*</code> (not canvas document tokens).</li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>LAB · Waypoint board</span>
              <LabLocationSkinPlate skin="waypoint" testId="loc-lab-skin-waypoint">
                <div className={labStyles.locLabSkinWayRoot}>
                  <div className={labStyles.locLabSkinWayFork} aria-hidden>
                    ◀ Salt clock · Glass spine · Mirage well ▶
                  </div>
                  <div className={labStyles.locLabSkinTitle}>Salt Clock Relay · Mile 44</div>
                  <div className={labStyles.locLabSkinMetaRow}>
                    <span className={labStyles.locLabSkinMetaKey}>Region</span>
                    Glass Dune Protectorate · caravan lane
                  </div>
                  <div className={labStyles.locLabSkinMetaRow}>
                    <span className={labStyles.locLabSkinMetaKey}>Detail</span>
                    Last hand-painted sign before the horizon eats the road
                  </div>
                  <div className={labStyles.locLabSkinNotesWrap}>
                    <span className={labStyles.locLabSkinNotesLabel}>Notes</span>
                    <p className={labStyles.locLabSkinNotesBody}>
                      Warm board + rail: fork copy stays prose until item links can echo real graph edges.
                    </p>
                  </div>
                </div>
              </LabLocationSkinPlate>
              <ul className={labStyles.spec}>
                <li>Waypoint: warm field + mono fork strip; distinct fiction from the other two swatches.</li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>LAB · Deed cadastral slip</span>
              <LabLocationSkinPlate skin="deed" testId="loc-lab-skin-deed">
                <div className={labStyles.locLabSkinDeedRoot}>
                  <div className={labStyles.locLabSkinDeedSeal} aria-hidden>
                    Crown cadastre · excerpt (fictional)
                  </div>
                  <div className={labStyles.locLabSkinDeedRibbon}>ROLL 442-Q · BOUNDARY DISPUTE (OPEN)</div>
                  <div className={labStyles.locLabSkinTitle}>Threadable Courtyard · Sealed wing</div>
                  <div className={labStyles.locLabSkinMetaRow}>
                    <span className={labStyles.locLabSkinMetaKey}>Jurisdiction</span>
                    Magistrate circuit VII · liturgy vaults
                  </div>
                  <div className={labStyles.locLabSkinMetaRow}>
                    <span className={labStyles.locLabSkinMetaKey}>Tenure</span>
                    Crown leasehold · choir hours only
                  </div>
                  <div className={labStyles.locLabSkinNotesWrap}>
                    <span className={labStyles.locLabSkinNotesLabel}>Notes</span>
                    <p className={labStyles.locLabSkinNotesBody}>
                      Parchment + double rule: ribbon plays the optional <code>ref</code> stamp role without a new DB field.
                    </p>
                  </div>
                </div>
              </LabLocationSkinPlate>
              <ul className={labStyles.spec}>
                <li>Deed: parchment gradient + double border; ribbon = optional ref slot, still lab-only.</li>
              </ul>
            </div>
          </div>

          <h3 id="sec-location-concept-next" className={labStyles.subsectionTitle}>
            Location · concept next
          </h3>
          <p className={labStyles.sectionHint}>
            <strong>Additive only:</strong> new IA shapes here; rows above (seeds + lab skins) stay as-is. Polaroid
            memory slip, night-line poster (optional full-bleed backdrop), and museum specimen tag — each includes at
            least one image slot via local file pick (data URL lab preview, not persisted).
          </p>
          <div className={labStyles.grid}>
            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>NEXT · Polaroid field slip</span>
              <LabLocationConceptPolaroid testId="loc-concept-polaroid" />
              <ul className={labStyles.spec}>
                <li>Memory / evidence metaphor: fat white frame, chin strip, hero photo drives the card.</li>
              </ul>
            </div>
            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>NEXT · Night-line poster</span>
              <LabLocationConceptPoster testId="loc-concept-poster" />
              <ul className={labStyles.spec}>
                <li>Transit-poster scale: scrim + display type; backdrop image optional.</li>
              </ul>
            </div>
            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>NEXT · Museum specimen tag</span>
              <LabLocationConceptSpecimen testId="loc-concept-specimen" />
              <ul className={labStyles.spec}>
                <li>Collection rail + thumb + monospace ID — vertical authority strip, not document meta rows.</li>
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
