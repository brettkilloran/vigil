"use client";

/**
 * Lore entity node design lab. Previews are static HTML; production wiring can use
 * `items.entity_type` (character | faction | location) plus optional `content_json.hgArch`
 * keys such as `cardVariant` once a direction is chosen.
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
          applyImageDataUrlToArchitecturalMediaBody(prev, dataUrl, alt, portraitCommittedClass),
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

  useEffect(() => {
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
            Works for nations, cities, neighborhoods, buildings, or any site. Three header lines:
            name, nation, then a flexible third line (type, ward, grid ref, whatever fits the story).
            Everything below is free-form document.
          </p>
          <div className={labStyles.grid}>
            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V1 · Site plaque</span>
              <LabCard headerTitle="Location" tapeVariant="masking" tapeRotation={1.5}>
                <div className={cardStyles.locHeader}>
                  <div className={cardStyles.locName}>Old Harbor Kiln No. 4</div>
                  <div className={cardStyles.locMetaLine}>
                    <span className={cardStyles.locMetaKey}>Nation</span>
                    Kestrel Free City
                  </div>
                  <div className={cardStyles.locMetaLine}>
                    <span className={cardStyles.locMetaKey}>Site</span>
                    Dock ward · industrial brick
                  </div>
                </div>
                <div className={cardStyles.notesBlock}>
                  <span className={cardStyles.fieldLabel}>Notes</span>
                  <p className={cardStyles.notesText}>
                    Rumored meeting spot for the Exchange. Third line is intentionally generic so you
                    can use “Region”, “Floor”, “Dungeon level”, etc.
                  </p>
                </div>
              </LabCard>
              <ul className={labStyles.spec}>
                <li>Serif name = “place as title”; pair with any scale of location.</li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V2 · Postcard band</span>
              <LabCard headerTitle="Location" tapeVariant="clear" tapeRotation={-2}>
                <div className={cardStyles.postcardBand} aria-hidden />
                <div className={cardStyles.locHeader}>
                  <div className={cardStyles.locName}>Old Harbor Kiln No. 4</div>
                  <div className={cardStyles.locMetaLine}>Kestrel Free City</div>
                  <div className={cardStyles.locMetaLine}>
                    <span className={cardStyles.locMetaKey}>Detail</span>
                    Dock ward · industrial brick
                  </div>
                </div>
                <div className={cardStyles.notesBlock}>
                  <span className={cardStyles.fieldLabel}>Notes</span>
                  <p className={cardStyles.notesText}>
                    Color band suggests landscape / atmosphere without requiring an image asset.
                  </p>
                </div>
              </LabCard>
              <ul className={labStyles.spec}>
                <li>Band can sample accent or biome hue per location later.</li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V3 · Survey tag</span>
              <LabCard headerTitle="Location" tapeVariant="dark" tapeRotation={0.8}>
                <div
                  className={cardStyles.locPlaqueStrip}
                  data-loc-strip={locationStripVariantFromSeed("lab-survey-tag-v3")}
                  aria-hidden={true}
                />
                <div className={cardStyles.plaqueCorner}>REF · KFC-DOCK-0847</div>
                <div className={cardStyles.locHeader}>
                  <div className={cardStyles.locName}>Old Harbor Kiln No. 4</div>
                  <div className={cardStyles.locMetaLine}>
                    <span className={cardStyles.locMetaKey}>Nation</span>
                    Kestrel Free City
                  </div>
                  <div className={cardStyles.locMetaLine}>
                    <span className={cardStyles.locMetaKey}>Kind</span>
                    Warehouse · abandoned ceramic works
                  </div>
                </div>
                <div className={cardStyles.notesBlock}>
                  <span className={cardStyles.fieldLabel}>Notes</span>
                  <p className={cardStyles.notesText}>
                    Optional reference code for GMs; third line names the specific “kind” of place.
                  </p>
                </div>
              </LabCard>
              <ul className={labStyles.spec}>
                <li>Field labels stay editable copy—swap “Kind” for “District”, “Floor”, etc.</li>
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
