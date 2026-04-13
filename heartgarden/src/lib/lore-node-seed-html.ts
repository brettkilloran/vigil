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
import { HEARTGARDEN_MEDIA_PLACEHOLDER_SRC } from "@/src/lib/heartgarden-media-placeholder";
import { heartgardenMediaPlaceholderClassList } from "@/src/lib/heartgarden-media-placeholder-classes";

/** @deprecated Prefer `HEARTGARDEN_MEDIA_PLACEHOLDER_SRC` from `@/src/lib/heartgarden-media-placeholder`. */
export const LORE_PORTRAIT_PLACEHOLDER_DARK = HEARTGARDEN_MEDIA_PLACEHOLDER_SRC;

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
  if (kind === "character") return "v11";
  if (kind === "location") return "v2";
  return "v1";
}

export function tapeVariantForLoreCard(kind: LoreCardKind, variant: LoreCardVariant): TapeVariant {
  if (kind === "character") {
    return "dark";
  }
  if (kind === "faction") {
    if (variant === "v2") return "masking";
    return "clear";
  }
  /* location: v2 postcard band, v3 survey tag */
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
<span class="${s.charSkHeaderMeta}" contenteditable="false" spellcheck="false" title="Catalog ID">${LORE_V9_HEADER_META_PLACEHOLDER}</span>
</div>
<span role="button" tabindex="0" class="${s.charSkExpandBtn}" data-expand-btn="true" aria-label="Focus mode" title="Focus mode" contenteditable="false">
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M200 64v64a8 8 0 0 1-16 0V83.3l-45.2 45.1a8 8 0 0 1-11.3-11.3L172.7 72H136a8 8 0 0 1 0-16h64a8 8 0 0 1 8 8Zm-88 88H72v36.7l45.2-45.1a8 8 0 0 1 11.3 11.3L83.3 200H120a8 8 0 0 1 0 16H56a8 8 0 0 1-8-8v-64a8 8 0 0 1 16 0Z"/></svg>
</span>
</div>
</div>
<div class="${s.charSkPhotoCell}">
<div class="${s.charSkPhotoWrap}" contenteditable="false">
<div class="${s.charSkMediaRoot}" data-architectural-media-root="true" data-hg-lore-portrait-root="v11" contenteditable="false">
<img class="${s.charSkPortraitImg} ${heartgardenMediaPlaceholderClassList("neutral")}" src="${HEARTGARDEN_MEDIA_PLACEHOLDER_SRC}" alt="" width="240" height="180" contenteditable="false" draggable="false" data-hg-heartgarden-media-placeholder="true" data-hg-portrait-placeholder="true" />
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

function locationV2(): string {
  return `<div data-hg-canvas-role="lore-location" data-hg-lore-location-variant="v2">
<div class="${s.postcardBand}" aria-hidden="true"></div>
<div class="${s.locHeader}" contenteditable="false">
<div class="${s.locName}" data-hg-lore-location-field="name" contenteditable="true" spellcheck="false">Place name</div>
<div class="${s.locMetaLine}" data-hg-lore-location-optional="true"><span data-hg-lore-location-field="context" contenteditable="true" spellcheck="false"><br></span></div>
<div class="${s.locMetaLine}" data-hg-lore-location-optional="true"><span class="${s.locMetaKey}">Detail</span><span data-hg-lore-location-field="detail" contenteditable="true" spellcheck="false"><br></span></div>
</div>
<div class="${s.notesBlock}" data-hg-lore-location-notes-cell="true">
<span class="${s.fieldLabel}">Notes</span>
<div class="${s.notesText}" data-hg-lore-location-notes="true" contenteditable="true" spellcheck="false"><p><br></p></div>
</div>
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
  return `<div data-hg-canvas-role="lore-location" data-hg-lore-location-variant="v3">
<div class="${s.locPlaqueStrip}" data-loc-strip="${si}" aria-hidden="true"></div>
<div class="${s.plaqueCorner}" data-hg-lore-location-field="ref" contenteditable="true" spellcheck="false"><br></div>
<div class="${s.locHeader}" contenteditable="false">
<div class="${s.locName}" data-hg-lore-location-field="name" contenteditable="true" spellcheck="false">Place name</div>
<div class="${s.locMetaLine}" data-hg-lore-location-optional="true"><span class="${s.locMetaKey}">Nation</span><span data-hg-lore-location-field="context" contenteditable="true" spellcheck="false"><br></span></div>
<div class="${s.locMetaLine}" data-hg-lore-location-optional="true"><span class="${s.locMetaKey}">Kind</span><span data-hg-lore-location-field="detail" contenteditable="true" spellcheck="false"><br></span></div>
</div>
<div class="${s.notesBlock}" data-hg-lore-location-notes-cell="true">
<span class="${s.fieldLabel}">Notes</span>
<div class="${s.notesText}" data-hg-lore-location-notes="true" contenteditable="true" spellcheck="false"><p><br></p></div>
</div>
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
  if (variant === "v3") {
    const seed = options?.locationStripSeed ?? "__hg-loc-v3-default__";
    return locationV3(locationStripVariantFromSeed(seed));
  }
  return locationV2();
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
  if (kind === "location") {
    if (v === "v1") return { kind: "location", variant: "v2" };
    if (v !== "v2" && v !== "v3") return;
    return { kind: "location", variant: v };
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

/** Saved HTML from an older location template (before `data-hg-canvas-role`). */
function bodyHtmlImpliesLoreLocationLegacy(html: string): boolean {
  if (!html) return false;
  if (html.includes('data-hg-canvas-role="lore-location"')) return false;
  return html.includes("locHeader") && html.includes("locName") && html.includes("notesText");
}

/** Location nodes: structured lines on canvas; notes edited in focus (hidden on canvas via CSS). */
export function shouldRenderLoreLocationCanvasNode(
  entity: Pick<CanvasContentEntity, "kind" | "bodyHtml" | "loreCard">,
): boolean {
  if (entity.kind !== "content") return false;
  if (entity.loreCard?.kind === "location") return true;
  return (
    entity.bodyHtml.includes('data-hg-canvas-role="lore-location"') ||
    bodyHtmlImpliesLoreLocationLegacy(entity.bodyHtml)
  );
}
