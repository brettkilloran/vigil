/**
 * Faction Archive-091 readable: canonical `bodyHtml` shape (rails + letterhead + record).
 * Member roster rows live in `content_json.hgArch.factionRoster`, not in this HTML.
 */

import loreCardStyles from "@/src/components/foundation/lore-entity-card.module.css";
import { FACTION_ROSTER_HG_ARCH_KEY } from "@/src/lib/faction-roster-schema";
import { plainTextFromInlineHtmlFragment } from "@/src/lib/hg-doc/html-to-doc";
import { LORE_V9_REDACTED_SENTINEL } from "@/src/lib/lore-v9-placeholder";

const s = loreCardStyles;

/** Default Record HTML — must match XX · Archive-091 readable on `/dev/lore-entity-nodes`. */
export const FACTION_ARCHIVE091_READABLE_DEFAULT_RECORD_HTML = `<p>To reach <em>the Absolute Neutral</em>, surrender the chronological anchor. Catalog the exterior, then displace it in the ledger furnace — Ironwood tariff binders only.</p><p>The horizon does not curve for the eye; it curves for the soul. We are the quiet space between charter clauses.</p><p><em>Structured members: use hgArch.${FACTION_ROSTER_HG_ARCH_KEY} (JSON) in the index below — not ad-hoc metrics rows.</em></p>`;

function parseWrapped(html: string): HTMLElement | null {
  if (typeof DOMParser === "undefined") return null;
  try {
    const doc = new DOMParser().parseFromString(`<div id="__hg_faction_arc">${html}</div>`, "text/html");
    return doc.getElementById("__hg_faction_arc");
  } catch {
    return null;
  }
}

/** Split object id across vertical rails (same idea as lab UUID rails). */
export function factionArchiveRailTextsFromObjectId(objectId: string): { upper: string; lower: string } {
  const full = objectId.replace(/\s+/g, "").toUpperCase();
  if (!full) return { upper: "—", lower: "—" };
  const mid = Math.floor(full.length / 2);
  return { upper: full.slice(0, mid), lower: full.slice(mid) };
}

function escapeHtmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const EXPAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M200 64v64a8 8 0 0 1-16 0V83.3l-45.2 45.1a8 8 0 0 1-11.3-11.3L172.7 72H136a8 8 0 0 1 0-16h64a8 8 0 0 1 8 8Zm-88 88H72v36.7l45.2-45.1a8 8 0 0 1 11.3 11.3L83.3 200H120a8 8 0 0 1 0 16H56a8 8 0 0 1-8-8v-64a8 8 0 0 1 16 0Z"/></svg>`;

/**
 * Canonical persisted HTML for faction Archive-091 nodes.
 * `recordInnerHtml` is TipTap `generateHTML` output (trusted).
 */
export function buildFactionArchive091BodyHtml(parts: {
  orgPrimaryInnerHtml: string;
  orgAccentInnerHtml: string;
  recordInnerHtml: string;
  railUpper: string;
  railLower: string;
}): string {
  const primary = (parts.orgPrimaryInnerHtml ?? "").trim() || LORE_V9_REDACTED_SENTINEL;
  const accent = (parts.orgAccentInnerHtml ?? "").trim() || LORE_V9_REDACTED_SENTINEL;
  const record = (parts.recordInnerHtml ?? "").trim()
    ? parts.recordInnerHtml
    : FACTION_ARCHIVE091_READABLE_DEFAULT_RECORD_HTML;
  const ph = LORE_V9_REDACTED_SENTINEL;
  const primaryPh = primary === ph || primary === "";
  const accentPh = accent === ph || accent === "";

  const primaryAttrs = primaryPh
    ? ` data-hg-lore-field="1" data-hg-lore-placeholder="true" data-hg-lore-ph="${ph}"`
    : "";
  const accentAttrs = accentPh
    ? ` data-hg-lore-field="1" data-hg-lore-placeholder="true" data-hg-lore-ph="${ph}"`
    : "";

  return `<div data-hg-canvas-role="lore-faction" data-hg-lore-faction-variant="archive091" class="${s.facArxxRoot}" contenteditable="false">
<div class="${s.facArxxPage}" contenteditable="false">
<aside class="${s.facArxxRail}" aria-hidden="true" contenteditable="false">
<div class="${s.facArxxVertical}" data-hg-faction-archive-rail="upper" contenteditable="false">${escapeHtmlText(parts.railUpper)}</div>
<svg class="${s.facArxxStar}" viewBox="0 0 24 24" aria-hidden="true" contenteditable="false"><path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" fill="currentColor" /></svg>
<div class="${s.facArxxVertical}" data-hg-faction-archive-rail="lower" contenteditable="false">${escapeHtmlText(parts.railLower)}</div>
<div class="${s.facArxxBarcode}" aria-hidden="true" contenteditable="false"></div>
</aside>
<div class="${s.facArxxMain}" contenteditable="false">
<div class="${s.facArxxFocusTop}" data-hg-faction-archive-drag-handle="true" contenteditable="false">
<div class="${s.facArxxPlateHeader}" contenteditable="false">
<span class="${s.facArxxPlateHeaderTitle}" contenteditable="false">Faction</span>
<div class="${s.facArxxPlateHeaderActions}" contenteditable="false">
<button type="button" class="${s.facArxxPlateHeaderBtn}" data-expand-btn="true" aria-label="Focus mode" title="Focus mode" contenteditable="false">${EXPAND_SVG}</button>
</div>
</div>
</div>
<div class="${s.facArxxRule}" role="presentation" aria-hidden="true" contenteditable="false"></div>
<header class="${s.facArxxLetterhead}" contenteditable="false">
<div class="${s.charSkShellV11} ${s.facArxxLetterheadPh}" data-hg-lore-faction-letterhead-shell="1" contenteditable="false">
<h1 class="${s.charSkDisplayName} ${s.facArxxLetterheadPrimary}" contenteditable="true" spellcheck="false" data-hg-lore-faction-field="orgNamePrimary"${primaryAttrs}>${primary}</h1>
<div class="${s.charSkRole} ${s.facArxxLetterheadSecondary}" contenteditable="true" spellcheck="false" data-hg-lore-faction-field="orgNameAccent"${accentAttrs}>${accent}</div>
</div>
</header>
<div class="${s.facArxxRule}" role="presentation" aria-hidden="true" contenteditable="false"></div>
<div class="${s.facArxxTextSection}" contenteditable="false">
<h2 class="${s.facArxxH2}" contenteditable="false">Record</h2>
<div class="${s.facArxxRecordCell}" data-hg-lore-faction-record-cell="true" contenteditable="false">
<div data-hg-lore-faction-record="true" class="${s.facArxxRecordInner}" contenteditable="false">${record}</div>
</div>
</div>
</div>
</div>
</div>`;
}

export function bodyHtmlImpliesFactionArchive091(html: string): boolean {
  return html.includes('data-hg-lore-faction-variant="archive091"');
}

export type FactionArchive091Parsed = {
  orgPrimaryInnerHtml: string;
  orgAccentInnerHtml: string;
  recordInnerHtml: string;
  railUpper: string;
  railLower: string;
};

export function parseFactionArchive091BodyHtml(html: string): FactionArchive091Parsed | null {
  const root = parseWrapped(html);
  if (!root) return null;
  const host = root.querySelector('[data-hg-lore-faction-variant="archive091"]');
  if (!host) return null;

  const primary = host.querySelector<HTMLElement>('[data-hg-lore-faction-field="orgNamePrimary"]');
  const accent = host.querySelector<HTMLElement>('[data-hg-lore-faction-field="orgNameAccent"]');
  const record = host.querySelector<HTMLElement>('[data-hg-lore-faction-record="true"]');
  const railU = host.querySelector<HTMLElement>('[data-hg-faction-archive-rail="upper"]');
  const railL = host.querySelector<HTMLElement>('[data-hg-faction-archive-rail="lower"]');

  if (!primary || !accent || !record) return null;

  return {
    orgPrimaryInnerHtml: (primary.innerHTML || "").trim() || LORE_V9_REDACTED_SENTINEL,
    orgAccentInnerHtml: (accent.innerHTML || "").trim() || LORE_V9_REDACTED_SENTINEL,
    recordInnerHtml: (record.innerHTML || "").trim() || "<p><br></p>",
    railUpper: (railU?.textContent || "").trim() || "—",
    railLower: (railL?.textContent || "").trim() || "—",
  };
}

/** Sync vertical rail text from backend object id (compact uppercase split). */
export function withFactionArchiveObjectIdInRails(bodyHtml: string, objectId: string): string {
  const root = parseWrapped(bodyHtml);
  if (!root) return bodyHtml;
  const host = root.querySelector<HTMLElement>('[data-hg-lore-faction-variant="archive091"]');
  if (!host) return bodyHtml;
  const { upper, lower } = factionArchiveRailTextsFromObjectId(objectId);
  const railU = host.querySelector<HTMLElement>('[data-hg-faction-archive-rail="upper"]');
  const railL = host.querySelector<HTMLElement>('[data-hg-faction-archive-rail="lower"]');
  if (railU) railU.textContent = upper;
  if (railL) railL.textContent = lower;
  return host.outerHTML;
}

/** Plain-text primary org line for graph title / focus title derivation. */
export function plainFactionPrimaryNameFromArchiveBodyHtml(bodyHtml: string): string {
  const p = parseFactionArchive091BodyHtml(bodyHtml);
  if (!p) return "";
  const text = plainTextFromInlineHtmlFragment(p.orgPrimaryInnerHtml);
  if (!text || text === LORE_V9_REDACTED_SENTINEL) return "";
  return text;
}
