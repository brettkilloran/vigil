import type {
  CanvasContentEntity,
  LoreCard,
  LoreCardKind,
  LoreCardVariant,
  TapeVariant,
} from "@/src/components/foundation/architectural-types";

import { LORE_V9_HEADER_META_PLACEHOLDER } from "@/src/lib/lore-v9-placeholder";
import archBodyStyles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import loreCardStyles from "@/src/components/foundation/lore-entity-card.module.css";
import { mediaUploadActionLabel } from "@/src/components/foundation/architectural-media-html";

/** v11 portrait placeholder (4:3); base tone comes from CSS on the `img` (plate-relative). */
export const LORE_PORTRAIT_PLACEHOLDER_DARK =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180">
<g opacity="0.5" stroke="rgba(255,255,255,0.09)" stroke-width="0.55" stroke-linecap="square">
<line x1="0" y1="45" x2="240" y2="45"/><line x1="0" y1="90" x2="240" y2="90"/><line x1="0" y1="135" x2="240" y2="135"/>
<line x1="60" y1="0" x2="60" y2="180"/><line x1="120" y1="0" x2="120" y2="180"/><line x1="180" y1="0" x2="180" y2="180"/>
</g>
<g fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter">
<path d="M10 20 L10 8 L22 8"/><path d="M218 8 L230 8 L230 20"/><path d="M10 160 L10 172 L22 172"/><path d="M230 160 L230 172 L218 172"/>
</g>
<g stroke="rgba(255,255,255,0.14)" stroke-width="1" stroke-linecap="square">
<line x1="112" y1="90" x2="128" y2="90"/><line x1="120" y1="82" x2="120" y2="98"/>
</g>
<g opacity="0.55" stroke="rgba(255,255,255,0.08)" stroke-width="0.5" stroke-linecap="square">
<line x1="6" y1="90" x2="16" y2="90"/><line x1="224" y1="90" x2="234" y2="90"/>
<line x1="120" y1="6" x2="120" y2="16"/><line x1="120" y1="164" x2="120" y2="174"/>
</g>
</svg>`,
  );

const s = loreCardStyles;

/** v11 only: succinct placeholders via `data-hg-lore-ph` + CSS (not saved as field text). */
export const LORE_V11_PH_DISPLAY_NAME = "Name";
const LORE_V11_PH_ROLE = "Role";
const LORE_V11_PH_AFFILIATION = "Group";
const LORE_V11_PH_NATIONALITY = "Origin";
const LORE_V11_PH_NOTES = "Notes";

export function defaultTitleForLoreKind(kind: LoreCardKind): string {
  if (kind === "character") return "Unnamed";
  if (kind === "faction") return "New organization";
  return "New location";
}

/** Default `loreCard.variant` when creating nodes or inferring from `entity_type` without `hgArch`. */
export function defaultLoreCardVariantForKind(kind: LoreCardKind): LoreCardVariant {
  return kind === "character" ? "v11" : "v1";
}

export function tapeVariantForLoreCard(kind: LoreCardKind, variant: LoreCardVariant): TapeVariant {
  if (kind === "character") {
    return "dark";
  }
  if (kind === "faction") {
    if (variant === "v2") return "masking";
    return "clear";
  }
  if (variant === "v1") return "masking";
  if (variant === "v2") return "clear";
  return "dark";
}

/** Character v11 — ID plate; empty fields use `data-hg-lore-placeholder` + optional `data-hg-lore-ph` (CSS only; not saved as text). */
function characterV11(): string {
  return `<div class="${s.charSkShell} ${s.charSkShellV11}" contenteditable="false">
<div class="${s.charSkCard}" contenteditable="false">
<div class="${s.charSkCardMaterial}">
<div class="${s.charSkGrid}">
<div class="${s.charSkHeaderCell}" data-hg-lore-canvas-drag-header="true">
<div class="${s.charSkLanyard}" aria-hidden="true"></div>
<div class="${s.charSkHeaderRow}">
<div class="${s.charSkHeaderLeft}">
<span class="${s.charSkHeaderMeta}" contenteditable="true" spellcheck="false" data-hg-lore-field="1" data-hg-lore-placeholder="true" title="Catalog ID">${LORE_V9_HEADER_META_PLACEHOLDER}</span>
</div>
<span role="button" tabindex="0" class="${s.charSkExpandBtn}" data-expand-btn="true" aria-label="Focus mode" title="Focus mode" contenteditable="false">
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M200 64v64a8 8 0 0 1-16 0V83.3l-45.2 45.1a8 8 0 0 1-11.3-11.3L172.7 72H136a8 8 0 0 1 0-16h64a8 8 0 0 1 8 8Zm-88 88H72v36.7l45.2-45.1a8 8 0 0 1 11.3 11.3L83.3 200H120a8 8 0 0 1 0 16H56a8 8 0 0 1-8-8v-64a8 8 0 0 1 16 0Z"/></svg>
</span>
</div>
</div>
<div class="${s.charSkPhotoCell}">
<div class="${s.charSkPhotoWrap}" contenteditable="false">
<div class="${s.charSkMediaRoot}" data-architectural-media-root="true" data-hg-lore-portrait-root="v11" contenteditable="false">
<img class="${s.charSkPortraitImg}" src="${LORE_PORTRAIT_PLACEHOLDER_DARK}" alt="" width="240" height="180" contenteditable="false" draggable="false" data-hg-portrait-placeholder="true" />
<div data-hg-portrait-actions="true" contenteditable="false">
<button type="button" class="vigil-btn ${archBodyStyles.mediaUploadBtn}" data-variant="ghost" data-size="sm" data-tone="glass" data-architectural-media-upload="true">${mediaUploadActionLabel(false)}</button>
</div>
</div>
</div>
</div>
<div class="${s.charSkIdentityCell}">
<div class="${s.charSkNameBlock}">
<div class="${s.charSkNameHeading}">
<span class="${s.charSkFieldLabel}">Name</span>
<div class="${s.charSkDisplayName}" contenteditable="true" spellcheck="false" data-hg-lore-field="1" data-hg-lore-placeholder="true" data-hg-lore-ph="${LORE_V11_PH_DISPLAY_NAME}"><br></div>
</div>
<div class="${s.charSkNameTail}">
<span class="${s.charSkRole}" contenteditable="true" spellcheck="false" data-hg-lore-field="1" data-hg-lore-placeholder="true" data-hg-lore-ph="${LORE_V11_PH_ROLE}"><br></span>
</div>
</div>
<div class="${s.charSkMetaBlock}">
<div class="${s.charSkMetaRow}">
<span class="${s.charSkFieldLabel}">Affiliation</span>
<span class="${s.charSkMetaValue}" contenteditable="true" spellcheck="false" data-hg-lore-field="1" data-hg-lore-placeholder="true" data-hg-lore-ph="${LORE_V11_PH_AFFILIATION}"><br></span>
</div>
<div class="${s.charSkMetaRow}">
<span class="${s.charSkFieldLabel}">Nationality</span>
<span class="${s.charSkMetaValue}" contenteditable="true" spellcheck="false" data-hg-lore-field="1" data-hg-lore-placeholder="true" data-hg-lore-ph="${LORE_V11_PH_NATIONALITY}"><br></span>
</div>
</div>
</div>
<div class="${s.charSkNotesCell}">
<span class="${s.charSkFieldLabel}">Notes</span>
<div class="${s.charSkNotesBody}" contenteditable="true" spellcheck="false" data-hg-lore-field="1" data-hg-lore-placeholder="true" data-hg-lore-ph="${LORE_V11_PH_NOTES}"><p><br></p></div>
</div>
</div>
</div>
</div>
</div>`;
}

function factionV1(): string {
  return `<div class="${s.letterheadCenter}" contenteditable="false">
<div class="${s.letterheadMark}" aria-hidden="true"></div>
<div class="${s.orgName}" contenteditable="true" spellcheck="false">Organization name</div>
<div class="${s.orgRule}" aria-hidden="true"></div>
<div class="${s.nationLine}" contenteditable="true" spellcheck="false">Fictional nation</div>
</div>
<div class="${s.notesBlock}">
<span class="${s.fieldLabel}">Document</span>
<div class="${s.notesText}" contenteditable="true" spellcheck="false"><p>Charter, structure, relationships — keep this open-ended.</p></div>
</div>`;
}

function factionV2(): string {
  return `<div class="${s.letterheadAsym}" contenteditable="false">
<div class="${s.monogram}" aria-hidden="true">N</div>
<div>
<div class="${s.orgName}" contenteditable="true" spellcheck="false">Organization name</div>
<div class="${s.nationLine}" style="margin-top:8px;text-align:left" contenteditable="true" spellcheck="false">Fictional nation</div>
</div>
</div>
<div class="${s.notesBlock}">
<span class="${s.fieldLabel}">Document</span>
<div class="${s.notesText}" contenteditable="true" spellcheck="false"><p>Charter, structure, relationships — keep this open-ended.</p></div>
</div>`;
}

function factionV3(): string {
  return `<div class="${s.letterheadFrame}" contenteditable="false">
<div class="${s.orgName}" contenteditable="true" spellcheck="false">Organization name</div>
<div class="${s.nationLine}" style="margin-top:10px" contenteditable="true" spellcheck="false">Fictional nation</div>
</div>
<div class="${s.notesBlock}">
<span class="${s.fieldLabel}">Document</span>
<div class="${s.notesText}" contenteditable="true" spellcheck="false"><p>Charter, structure, relationships — keep this open-ended.</p></div>
</div>`;
}

function locationV1(): string {
  return `<div class="${s.locHeader}" contenteditable="false">
<div class="${s.locName}" contenteditable="true" spellcheck="false">Place name</div>
<div class="${s.locMetaLine}"><span class="${s.locMetaKey}">Nation</span><span contenteditable="true" spellcheck="false">Fictional nation</span></div>
<div class="${s.locMetaLine}"><span class="${s.locMetaKey}">Site</span><span contenteditable="true" spellcheck="false">Ward, building type, coordinates…</span></div>
</div>
<div class="${s.notesBlock}">
<span class="${s.fieldLabel}">Notes</span>
<div class="${s.notesText}" contenteditable="true" spellcheck="false"><p>Sensory detail, rumors, clocks — unstructured.</p></div>
</div>`;
}

function locationV2(): string {
  return `<div class="${s.postcardBand}" aria-hidden="true"></div>
<div class="${s.locHeader}" contenteditable="false">
<div class="${s.locName}" contenteditable="true" spellcheck="false">Place name</div>
<div class="${s.locMetaLine}" contenteditable="true" spellcheck="false">Fictional nation</div>
<div class="${s.locMetaLine}"><span class="${s.locMetaKey}">Detail</span><span contenteditable="true" spellcheck="false">District, level, site type…</span></div>
</div>
<div class="${s.notesBlock}">
<span class="${s.fieldLabel}">Notes</span>
<div class="${s.notesText}" contenteditable="true" spellcheck="false"><p>Sensory detail, rumors, clocks — unstructured.</p></div>
</div>`;
}

const LOC_PLAQUE_STRIP_VARIANTS = 8;

/** FNV-1a → 0..7 for `data-loc-strip` gradient presets. */
export function locationStripVariantFromSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h % LOC_PLAQUE_STRIP_VARIANTS;
}

function locationV3(stripIndex: number): string {
  const si =
    ((stripIndex % LOC_PLAQUE_STRIP_VARIANTS) + LOC_PLAQUE_STRIP_VARIANTS) % LOC_PLAQUE_STRIP_VARIANTS;
  return `<div class="${s.locPlaqueStrip}" data-loc-strip="${si}" aria-hidden="true"></div>
<div class="${s.plaqueCorner}" contenteditable="true" spellcheck="false">REF · optional code</div>
<div class="${s.locHeader}" contenteditable="false">
<div class="${s.locName}" contenteditable="true" spellcheck="false">Place name</div>
<div class="${s.locMetaLine}"><span class="${s.locMetaKey}">Nation</span><span contenteditable="true" spellcheck="false">Fictional nation</span></div>
<div class="${s.locMetaLine}"><span class="${s.locMetaKey}">Kind</span><span contenteditable="true" spellcheck="false">City, building, dungeon layer…</span></div>
</div>
<div class="${s.notesBlock}">
<span class="${s.fieldLabel}">Notes</span>
<div class="${s.notesText}" contenteditable="true" spellcheck="false"><p>Sensory detail, rumors, clocks — unstructured.</p></div>
</div>`;
}

export type LoreNodeSeedOptions = {
  /** Stable id (or uuid) → one of eight thin gradient strips on location v3. */
  locationStripSeed?: string;
};

export function getLoreNodeSeedBodyHtml(
  kind: LoreCardKind,
  variant: LoreCardVariant,
  options?: LoreNodeSeedOptions,
): string {
  if (kind === "character") {
    return characterV11();
  }
  if (kind === "faction") {
    if (variant === "v2") return factionV2();
    if (variant === "v3") return factionV3();
    return factionV1();
  }
  if (variant === "v2") return locationV2();
  if (variant === "v3") {
    const seed = options?.locationStripSeed ?? "__hg-loc-v3-default__";
    return locationV3(locationStripVariantFromSeed(seed));
  }
  return locationV1();
}

export function isLoreCardKind(value: string): value is LoreCardKind {
  return value === "character" || value === "faction" || value === "location";
}

export function parseLoreCard(raw: unknown): LoreCard | undefined {
  if (!raw || typeof raw !== "object") return;
  const o = raw as Record<string, unknown>;
  const k = o.kind;
  const v = o.variant;
  if (!isLoreCardKind(String(k))) return;
  if (typeof v !== "string") return;
  const kind = k as LoreCardKind;
  if (kind === "character") {
    /* Legacy stored variants (v3 passport, v8–v10, etc.) normalize to the canonical character template. */
    if (!v.length) return;
    return { kind: "character", variant: "v11" };
  }
  if (v !== "v1" && v !== "v2" && v !== "v3") return;
  return { kind, variant: v };
}

/** True when saved HTML is the v11 character ID plate (CSS-module class names still contain this segment). */
export function bodyHtmlImpliesLoreCharacterV11(html: string): boolean {
  if (!html) return false;
  return (
    html.includes("charSkShellV11") ||
    html.includes('data-hg-lore-portrait-root="v11"')
  );
}

/** Canvas should use the standalone character credential shell (not the generic A4 note card). */
export function shouldRenderLoreCharacterCredentialCanvasNode(
  entity: Pick<CanvasContentEntity, "kind" | "bodyHtml" | "loreCard">,
): boolean {
  if (entity.kind !== "content") return false;
  if (entity.loreCard?.kind === "character") return true;
  return bodyHtmlImpliesLoreCharacterV11(entity.bodyHtml);
}
