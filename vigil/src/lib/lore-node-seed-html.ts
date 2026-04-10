import type {
  LoreCard,
  LoreCardKind,
  LoreCardVariant,
  TapeVariant,
} from "@/src/components/foundation/architectural-types";

import archBodyStyles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import loreCardStyles from "@/src/components/foundation/lore-entity-card.module.css";

/** Placeholder portrait for new character nodes (SVG data URI, no network). */
export const LORE_PORTRAIT_PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#c5d0dc"/><stop offset="100%" stop-color="#8e9daf"/></linearGradient></defs><rect width="120" height="160" fill="url(#g)"/><ellipse cx="60" cy="56" rx="24" ry="28" fill="rgba(255,255,255,.4)"/><path d="M28 120 Q60 92 92 120 L92 160 L28 160 Z" fill="rgba(255,255,255,.32)"/></svg>`,
  );

/** Dark ID / v9 portrait well: reticle only; full-well fill comes from CSS (`--sk-portrait-placeholder-surface`). */
export const LORE_PORTRAIT_PLACEHOLDER_DARK =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160"><g fill="none" stroke="rgba(0,0,0,0.24)" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"><path d="M10 26 L10 10 L26 10"/><path d="M94 10 L110 10 L110 26"/><path d="M10 134 L10 150 L26 150"/><path d="M110 134 L110 150 L94 150"/></g><g stroke="rgba(0,0,0,0.14)" stroke-width="1"><line x1="52" y1="80" x2="68" y2="80"/><line x1="60" y1="72" x2="60" y2="88"/></g></svg>`,
  );

const s = loreCardStyles;

export function defaultTitleForLoreKind(kind: LoreCardKind): string {
  if (kind === "character") return "Unnamed";
  if (kind === "faction") return "New organization";
  return "New location";
}

/** Default `loreCard.variant` when creating nodes or inferring from `entity_type` without `hgArch`. */
export function defaultLoreCardVariantForKind(kind: LoreCardKind): LoreCardVariant {
  return kind === "character" ? "v9" : "v1";
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

function characterV3(): string {
  return `<div class="${s.passportStrip}" contenteditable="false">
<img class="${s.passportPhoto}" src="${LORE_PORTRAIT_PLACEHOLDER}" alt="" width="64" height="80" contenteditable="false" draggable="false" />
<div class="${s.passportMeta}" contenteditable="false">
<div>Given / Family<strong contenteditable="true" spellcheck="false">Given · Family</strong></div>
<div>Affiliation<strong contenteditable="true" spellcheck="false">Faction or organization</strong></div>
<div>Nationality<strong contenteditable="true" spellcheck="false">Fictional nation</strong></div>
</div>
</div>
<div class="${s.notesBlock}">
<span class="${s.fieldLabel}">Notes</span>
<div class="${s.notesText}" contenteditable="true" spellcheck="false"><p>Lore, hooks, and anything you will categorize later.</p></div>
</div>`;
}

function characterV8(): string {
  return `<div class="${s.char3dShell}" contenteditable="false">
<div class="${s.char3dViewport}" contenteditable="false">
<div class="${s.char3dCard}" contenteditable="false">
<div class="${s.char3dCardMaterial}">
<div class="${s.char3dGlare}" aria-hidden="true"></div>
<div class="${s.char3dGrid}">
<div class="${s.char3dHeaderCell}">
<div class="${s.char3dLanyard}" aria-hidden="true"></div>
<div class="${s.char3dHeaderRow}">
<div class="${s.char3dHeaderLeft}">
<span class="${s.char3dLabel}">SEC-CLRN // L1</span>
</div>
<span role="button" tabindex="0" class="${s.char3dExpandBtn}" data-expand-btn="true" aria-label="Focus mode" title="Focus mode" contenteditable="false">
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M200 64v64a8 8 0 0 1-16 0V83.3l-45.2 45.1a8 8 0 0 1-11.3-11.3L172.7 72H136a8 8 0 0 1 0-16h64a8 8 0 0 1 8 8Zm-88 88H72v36.7l45.2-45.1a8 8 0 0 1 11.3 11.3L83.3 200H120a8 8 0 0 1 0 16H56a8 8 0 0 1-8-8v-64a8 8 0 0 1 16 0Z"/></svg>
</span>
</div>
</div>
<div class="${s.char3dPhotoCell}">
<div class="${s.char3dPhotoWrap}" contenteditable="false">
<div class="${s.char3dMediaRoot}" data-architectural-media-root="true" data-hg-lore-portrait-root="v8" contenteditable="false">
<div class="${s.char3dMediaPlaceholder}" data-architectural-media-fallback="true">Upload portrait</div>
<div data-hg-portrait-actions="true" contenteditable="false">
<button type="button" class="${archBodyStyles.mediaUploadBtn}" data-architectural-media-upload="true">Upload</button>
</div>
</div>
</div>
</div>
<div class="${s.char3dIdentityCell}">
<div class="${s.char3dNameBlock}">
<div class="${s.char3dNameHeading}">
<span class="${s.char3dLabel}">Identification</span>
<div class="${s.char3dName}">
<span contenteditable="true" spellcheck="false">Given</span>
<span contenteditable="true" spellcheck="false">Family</span>
</div>
</div>
<div class="${s.char3dNameTail}">
<span class="${s.char3dRole}" contenteditable="true" spellcheck="false">Operative</span>
<div class="${s.char3dAux}">
<div class="${s.char3dAuxLine}">
<span class="${s.char3dLabel}">Internal ref</span>
<span class="${s.char3dAuxValue} ${s.char3dRedacted}" contenteditable="true" spellcheck="false">HG-████</span>
</div>
<div class="${s.char3dAuxLine}">
<span class="${s.char3dLabel}">Directive sequence</span>
<span class="${s.char3dDirectiveMono}" contenteditable="true" spellcheck="false">01101000 01110101 01101110 01110100</span>
</div>
</div>
</div>
</div>
<div class="${s.char3dMetaBlock}">
<div class="${s.char3dMetaRow}">
<span class="${s.char3dLabel}">Affiliation</span>
<span class="${s.char3dMetaValue}" contenteditable="true" spellcheck="false">Faction or organization</span>
</div>
<div class="${s.char3dMetaRow}">
<span class="${s.char3dLabel}">Nationality</span>
<span class="${s.char3dMetaValue}" contenteditable="true" spellcheck="false">Fictional nation</span>
</div>
</div>
</div>
<div class="${s.char3dFooterCell}">
<div class="${s.char3dBarcode}" aria-hidden="true"></div>
<span class="${s.char3dAuthCode}">HG_LORE // VALID: TRUE</span>
</div>
<div class="${s.char3dNotesCell}">
<span class="${s.char3dLabel}">Notes</span>
<div class="${s.char3dNotesBody}" contenteditable="true" spellcheck="false"><p>Lore hooks and anything you will categorize later.</p></div>
</div>
</div>
</div>
</div>
</div>
</div>`;
}

function characterV9(): string {
  return `<div class="${s.charSkShell}" contenteditable="false">
<div class="${s.charSkCard}" contenteditable="false">
<div class="${s.charSkCardMaterial}">
<div class="${s.charSkGrid}">
<div class="${s.charSkHeaderCell}">
<div class="${s.charSkLanyard}" aria-hidden="true"></div>
<div class="${s.charSkHeaderRow}">
<div class="${s.charSkHeaderLeft}">
<span class="${s.charSkHeaderMeta}" contenteditable="true" spellcheck="false">CLGN-ID</span>
</div>
<span role="button" tabindex="0" class="${s.charSkExpandBtn}" data-expand-btn="true" aria-label="Focus mode" title="Focus mode" contenteditable="false">
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M200 64v64a8 8 0 0 1-16 0V83.3l-45.2 45.1a8 8 0 0 1-11.3-11.3L172.7 72H136a8 8 0 0 1 0-16h64a8 8 0 0 1 8 8Zm-88 88H72v36.7l45.2-45.1a8 8 0 0 1 11.3 11.3L83.3 200H120a8 8 0 0 1 0 16H56a8 8 0 0 1-8-8v-64a8 8 0 0 1 16 0Z"/></svg>
</span>
</div>
</div>
<div class="${s.charSkPhotoCell}">
<div class="${s.charSkPhotoWrap}" contenteditable="false">
<div class="${s.charSkMediaRoot}" data-architectural-media-root="true" data-hg-lore-portrait-root="v9" contenteditable="false">
<img class="${s.charSkPortraitImg}" src="${LORE_PORTRAIT_PLACEHOLDER_DARK}" alt="" width="240" height="320" contenteditable="false" draggable="false" data-hg-portrait-placeholder="true" />
<div class="${s.charSkPortraitBarcode}" data-hg-lore-portrait-barcode="true" contenteditable="false" aria-hidden="true"></div>
<div data-hg-portrait-actions="true" contenteditable="false">
<button type="button" class="${archBodyStyles.mediaUploadBtn}" data-architectural-media-upload="true">Upload</button>
</div>
</div>
</div>
</div>
<div class="${s.charSkIdentityCell}">
<div class="${s.charSkNameBlock}">
<div class="${s.charSkNameHeading}">
<span class="${s.charSkFieldLabel}">Identification</span>
<div class="${s.charSkDisplayName}" contenteditable="true" spellcheck="false">Name</div>
</div>
<div class="${s.charSkNameTail}">
<span class="${s.charSkRole}" contenteditable="true" spellcheck="false">Role</span>
</div>
</div>
<div class="${s.charSkMetaBlock}">
<div class="${s.charSkMetaRow}">
<span class="${s.charSkFieldLabel}">Affiliation</span>
<span class="${s.charSkMetaValue}" contenteditable="true" spellcheck="false">Faction</span>
</div>
<div class="${s.charSkMetaRow}">
<span class="${s.charSkFieldLabel}">Nationality</span>
<span class="${s.charSkMetaValue}" contenteditable="true" spellcheck="false">Nation</span>
</div>
</div>
</div>
<div class="${s.charSkNotesCell}">
<span class="${s.charSkFieldLabel}">Notes</span>
<div class="${s.charSkNotesBody}" contenteditable="true" spellcheck="false"><p>Hooks, stains, tags.</p></div>
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
    if (variant === "v3") return characterV3();
    if (variant === "v8") return characterV8();
    if (variant === "v9") return characterV9();
    return characterV9();
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
  let v = o.variant;
  if (!isLoreCardKind(String(k))) return;
  if (typeof v !== "string") return;
  const kind = k as LoreCardKind;
  if (kind === "character") {
    if (v === "v1" || v === "v2" || v === "v4" || v === "v5" || v === "v6" || v === "v7") {
      v = "v9";
    }
    if (v !== "v3" && v !== "v8" && v !== "v9") return;
    return { kind, variant: v as LoreCardVariant };
  }
  if (v !== "v1" && v !== "v2" && v !== "v3") return;
  return { kind, variant: v as LoreCardVariant };
}
