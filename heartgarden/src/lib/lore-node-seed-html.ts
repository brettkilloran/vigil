import type {
  CanvasContentEntity,
  LoreCard,
  LoreCardKind,
  LoreCardVariant,
  TapeVariant,
} from "@/src/components/foundation/architectural-types";

import { LORE_V9_HEADER_META_PLACEHOLDER, LORE_V9_REDACTED_SENTINEL } from "@/src/lib/lore-v9-placeholder";
import archBodyStyles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import loreCardStyles from "@/src/components/foundation/lore-entity-card.module.css";
import { mediaUploadActionLabel } from "@/src/components/foundation/architectural-media-html";
import { HEARTGARDEN_MEDIA_PLACEHOLDER_SRC } from "@/src/lib/heartgarden-media-placeholder";
import { heartgardenMediaPlaceholderClassList } from "@/src/lib/heartgarden-media-placeholder-classes";
import {
  focusDocumentHtmlToLocationBody,
  locationBodyToFocusDocumentHtml,
  LORE_V11_PH_LOCATION_PLACEHOLDER,
  normalizeLocOrdoV7NameField,
  parseLocationOrdoV7BodyPlainFields,
} from "@/src/lib/lore-location-focus-document-html";
import { splitOrdoV7DisplayName } from "@/src/lib/lore-location-ordo-display-name";
import { stripLegacyHtmlToPlainText } from "@/src/lib/hg-doc/html-to-doc";
import {
  buildFactionArchive091BodyHtml,
  factionArchiveRailTextsFromObjectId,
} from "@/src/lib/lore-faction-archive-html";

/** @deprecated Prefer `HEARTGARDEN_MEDIA_PLACEHOLDER_SRC` from `@/src/lib/heartgarden-media-placeholder`. */
export const LORE_PORTRAIT_PLACEHOLDER_DARK = HEARTGARDEN_MEDIA_PLACEHOLDER_SRC;

const s = loreCardStyles;

/** Same 8×8 masthead grid as lab `FAC_ORDO_PIXEL_GRID` (`LoreEntityNodeLab.tsx`). */
const ORDO_V7_LOGO_PIXEL_GRID: readonly (0 | 1)[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
];

function ordoV7LogoPixelHtml(): string {
  const cells = ORDO_V7_LOGO_PIXEL_GRID.map((row) =>
    row.map((on) => `<span class="${on ? s.locOrdoV7Px : s.locOrdoV7PxOff}" aria-hidden="true"></span>`).join(""),
  ).join("");
  return `<div class="${s.locOrdoV7PixelIcon}" aria-hidden="true">${cells}</div>`;
}

function escapeHtmlV7Field(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Canonical location v7 ORDO slab HTML — same shape as seeded `locationV7()` and `LoreLocationOrdoV7Slab`.
 * `notesInnerHtml` is trusted hgDoc HTML (TipTap `generateHTML`); other fields are plain text escaped here.
 */
export function buildLocationOrdoV7BodyHtml(parts: {
  name: string;
  context: string;
  detail: string;
  notesInnerHtml: string;
}): string {
  const nameTrim = normalizeLocOrdoV7NameField(parts.name);
  const namePlaceholder = !nameTrim;
  const { line1, line2 } = namePlaceholder
    ? { line1: "", line2: null as string | null }
    : splitOrdoV7DisplayName(nameTrim);
  const nameInner = namePlaceholder
    ? "<br>"
    : `${escapeHtmlV7Field(line1)}${line2 ? `<br />${escapeHtmlV7Field(line2)}` : ""}`;
  const nameAttrs = namePlaceholder
    ? ` data-hg-lore-field="name" data-hg-lore-placeholder="true" data-hg-lore-ph="${LORE_V11_PH_LOCATION_PLACEHOLDER}"`
    : "";
  const ctx = parts.context.trim();
  const det = parts.detail.trim();
  const notes = (parts.notesInnerHtml ?? "").trim() ? parts.notesInnerHtml : "<p><br></p>";
  const ctxAttrs = ctx
    ? ""
    : ` data-hg-lore-field="1" data-hg-lore-placeholder="true" data-hg-lore-ph="${LORE_V11_PH_LOCATION_CONTEXT}"`;
  return `<div data-hg-canvas-role="lore-location" data-hg-lore-location-variant="v7" class="${s.locOrdoV7Root}" contenteditable="false">
<div class="${s.locOrdoV7Geo}" aria-hidden="true"></div>
<div class="${s.locOrdoV7Glow}" aria-hidden="true"></div>
<span class="${s.locOrdoV7Staple}" aria-hidden="true" data-hg-lore-location-staple="v7"><span class="${s.locOrdoV7StapleMetal}" aria-hidden="true"></span></span>
<div class="${s.locOrdoV7Inner}">
<header class="${s.locOrdoV7Header}">
<div class="${s.locOrdoV7LogoBlock}">
${ordoV7LogoPixelHtml()}
</div>
<button type="button" class="${s.locOrdoV7ExpandBtn}" data-expand-btn="true" aria-label="Focus mode" title="Focus mode">
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M200 64v64a8 8 0 0 1-16 0V83.3l-45.2 45.1a8 8 0 0 1-11.3-11.3L172.7 72H136a8 8 0 0 1 0-16h64a8 8 0 0 1 8 8Zm-88 88H72v36.7l45.2-45.1a8 8 0 0 1 11.3 11.3L83.3 200H120a8 8 0 0 1 0 16H56a8 8 0 0 1-8-8v-64a8 8 0 0 1 16 0Z"/></svg>
</button>
</header>
<div class="${s.locOrdoV7DocGrid}">
<div class="${s.locOrdoV7TitleRow}">
<h1 class="${s.locOrdoV7DisplayTitle}" data-hg-lore-location-field="name"${nameAttrs} contenteditable="true" spellcheck="false">${nameInner}</h1>
</div>
<p class="${s.locOrdoV7ContextLine}" data-hg-lore-location-field="context"${ctxAttrs} contenteditable="true" spellcheck="false">${ctx ? escapeHtmlV7Field(ctx) : "<br>"}</p>
<div class="${s.locOrdoV7Main}">
<div class="${s.locOrdoV7ContentBlock}">
<p class="${s.locOrdoV7DetailLine}" data-hg-lore-location-field="detail" contenteditable="true" spellcheck="false">${det ? escapeHtmlV7Field(det) : "<br>"}</p>
<div class="${s.locOrdoV7NotesCell}" data-hg-lore-location-notes-cell="true" contenteditable="false">
<div data-hg-lore-location-notes="true" class="${s.locOrdoV7NotesInner}" contenteditable="true" spellcheck="false">${notes}</div>
</div>
</div>
</div>
</div>
</div>
</div>`;
}

/** Saved HTML uses the canonical v7 ORDO slab (React or seed). */
export function bodyHtmlImpliesLoreLocationOrdoV7(html: string): boolean {
  return html.includes('data-hg-lore-location-variant="v7"');
}

/**
 * v11-style placeholders via `data-hg-lore-ph` + CSS (caption + strip; not persisted as field text).
 * Location v7 context uses the same REDACTED sentinel as character inline fields.
 */
export const LORE_V11_PH_LOCATION_CONTEXT = LORE_V9_REDACTED_SENTINEL;
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
  if (kind === "location") return "v7";
  if (kind === "faction") return "v4";
  return "v1";
}

export function tapeVariantForLoreCard(kind: LoreCardKind, variant: LoreCardVariant): TapeVariant {
  if (kind === "character") {
    return "dark";
  }
  if (kind === "faction") {
    if (variant === "v2") return "masking";
    return "dark";
  }
  /* location: v2 postcard band, v3 survey tag, v7 ORDO slab */
  if (variant === "v7" || variant === "v2") return "clear";
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

/** Faction Archive-091 readable — canonical canvas/focus body (rails + letterhead + record). */
function factionArchive091Seed(seedForRails = "__hg-faction-archive__"): string {
  const { upper, lower } = factionArchiveRailTextsFromObjectId(seedForRails);
  return buildFactionArchive091BodyHtml({
    orgPrimaryInnerHtml: "",
    orgAccentInnerHtml: "",
    recordInnerHtml: "",
    railUpper: upper,
    railLower: lower,
  });
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

/** Location v7 · ORDO LUNARIS mono coordinate slab (canvas + focus; notes hidden on canvas). */
function locationV7(): string {
  return buildLocationOrdoV7BodyHtml({
    name: "",
    context: "",
    detail: "",
    notesInnerHtml: "<p><br></p>",
  });
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
  /** Optional seed for faction Archive-091 rail text split (defaults when omitted). */
  factionRailSeed?: string;
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
    return factionArchive091Seed(options?.factionRailSeed ?? "__hg-faction-archive__");
  }
  if (kind === "location") {
    if (variant === "v3") {
      const seed = options?.locationStripSeed ?? "__hg-loc-v3-default__";
      return locationV3(locationStripVariantFromSeed(seed));
    }
    if (variant === "v7") return locationV7();
    return locationV2();
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
    if (v === "v2" || v === "v3" || v === "v7") return { kind: "location", variant: v };
    return;
  }
  if (kind === "faction") {
    if (v === "v1" || v === "v2" || v === "v3" || v === "v4") return { kind: "faction", variant: "v4" };
    return;
  }
  return;
}

/** True when saved HTML is the v11 character ID plate (CSS-module class names still contain this segment). */
export function bodyHtmlImpliesLoreCharacterV11(html: string): boolean {
  if (!html) return false;
  /* Faction Archive-091 letterhead composes `charSkShellV11` for typography — not a character card. */
  if (html.includes('data-hg-lore-faction-variant="archive091"')) return false;
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
  if (entity.loreCard?.kind === "faction") return false;
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

/** Faction Archive-091 slab (rails + letterhead + record); roster from `factionRoster`. */
export function shouldRenderLoreFactionArchive091CanvasNode(
  entity: Pick<CanvasContentEntity, "kind" | "bodyHtml" | "loreCard">,
): boolean {
  if (entity.kind !== "content") return false;
  if (entity.loreCard?.kind === "faction") return true;
  return entity.bodyHtml.includes('data-hg-lore-faction-variant="archive091"');
}

/**
 * Migrates legacy v2/v3 (and older) location `bodyHtml` into the v7 ORDO shell; idempotent for v7.
 * Uses the focus projection merge path so field extraction matches `locationBodyToFocusDocumentHtml`.
 */
export function migrateLocationBodyToOrdoV7(bodyHtml: string): string {
  if (!bodyHtml.trim()) return locationV7();
  if (bodyHtml.includes('data-hg-lore-location-variant="v7"')) return bodyHtml;
  // Node-side callers don't have DOMParser. Returning the original body avoids data loss.
  if (typeof DOMParser === "undefined") return bodyHtml;
  try {
    const focus = locationBodyToFocusDocumentHtml(bodyHtml);
    const migrated = focusDocumentHtmlToLocationBody(focus, locationV7());
    const parsed = parseLocationOrdoV7BodyPlainFields(migrated);
    const plainNotes = stripLegacyHtmlToPlainText(parsed.notesHtml ?? "").trim();
    const migratedLooksEmpty =
      !parsed.name.trim() &&
      !parsed.context.trim() &&
      !parsed.detail.trim() &&
      plainNotes.length === 0;
    if (!migratedLooksEmpty) return migrated;
    const sourcePlain = stripLegacyHtmlToPlainText(bodyHtml).trim();
    if (!sourcePlain) return migrated;
    const sourceNotesInnerHtml = `<p>${escapeHtmlV7Field(sourcePlain).replace(/\n/g, "<br />")}</p>`;
    return buildLocationOrdoV7BodyHtml({
      name: "",
      context: "",
      detail: "",
      notesInnerHtml: sourceNotesInnerHtml,
    });
  } catch {
    return bodyHtml;
  }
}
