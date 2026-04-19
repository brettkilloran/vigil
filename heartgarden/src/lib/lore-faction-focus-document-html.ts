/**
 * Faction Archive-091: project canonical `bodyHtml` ↔ focus hybrid document (org fields + Record TipTap).
 */

import { LORE_V9_REDACTED_SENTINEL } from "@/src/lib/lore-v9-placeholder";
import {
  buildFactionArchive091BodyHtml,
  parseFactionArchive091BodyHtml,
} from "@/src/lib/lore-faction-archive-html";

const DEFAULT_RECORD_HTML = "<p><br></p>";

function parseWrapped(html: string): HTMLElement | null {
  if (typeof DOMParser === "undefined") return null;
  try {
    const doc = new DOMParser().parseFromString(`<div id="__hg_faction_focus">${html}</div>`, "text/html");
    return doc.getElementById("__hg_faction_focus");
  } catch {
    return null;
  }
}

function takeInnerHtml(root: ParentNode, selector: string, fallback: string): string {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) return fallback;
  const h = (el.innerHTML || "").trim();
  return h || fallback;
}

export type FactionFocusParts = {
  orgPrimaryHtml: string;
  orgAccentHtml: string;
  recordHtml: string;
};

function buildFactionFocusMetaBlockHtml(parts: FactionFocusParts): string {
  return `<div data-hg-faction-focus-meta="true" contenteditable="false">
<div data-hg-faction-focus-row="primary">
<span data-hg-faction-focus-label="true">Organization</span>
<div data-hg-faction-focus-field="orgNamePrimary" contenteditable="true" spellcheck="false">${parts.orgPrimaryHtml}</div>
</div>
<div data-hg-faction-focus-row="accent">
<span data-hg-faction-focus-label="true">Subtitle</span>
<div data-hg-faction-focus-field="orgNameAccent" contenteditable="true" spellcheck="false">${parts.orgAccentHtml}</div>
</div>
</div>`;
}

export function buildFactionFocusMetaShellHtml(parts: FactionFocusParts): string {
  return `<div data-hg-faction-focus-doc="v1">${buildFactionFocusMetaBlockHtml(parts)}</div>`;
}

export function extractFactionMetaFocusShellHtml(html: string): string {
  if (typeof DOMParser === "undefined") return "";
  try {
    const doc = new DOMParser().parseFromString(`<div id="__hg_fac_meta">${html}</div>`, "text/html");
    const root = doc.getElementById("__hg_fac_meta");
    const docRoot = root?.querySelector('[data-hg-faction-focus-doc="v1"]');
    const meta = docRoot?.querySelector('[data-hg-faction-focus-meta="true"]');
    if (!meta) return "";
    return `<div data-hg-faction-focus-doc="v1">${meta.outerHTML}</div>`;
  } catch {
    return "";
  }
}

export function readFactionFocusPartsFromMetaHost(metaHost: HTMLElement, recordHtml: string): FactionFocusParts {
  const root = metaHost as unknown as ParentNode;
  return {
    orgPrimaryHtml: takeInnerHtml(root, '[data-hg-faction-focus-field="orgNamePrimary"]', LORE_V9_REDACTED_SENTINEL),
    orgAccentHtml: takeInnerHtml(root, '[data-hg-faction-focus-field="orgNameAccent"]', LORE_V9_REDACTED_SENTINEL),
    recordHtml,
  };
}

export function buildFactionFocusDocumentHtml(parts: FactionFocusParts): string {
  return `<div data-hg-faction-focus-doc="v1">${buildFactionFocusMetaBlockHtml(parts)}
<div data-hg-faction-focus-record-shell="true" contenteditable="false">
<span data-hg-faction-focus-label="true">Record</span>
<div data-hg-faction-focus-record="true" contenteditable="true" spellcheck="false">${parts.recordHtml}</div>
</div>
</div>`;
}

export function parseFactionFocusDocumentHtml(html: string): FactionFocusParts | null {
  const root = parseWrapped(html);
  if (!root || !root.querySelector("[data-hg-faction-focus-record]")) return null;
  return {
    orgPrimaryHtml: takeInnerHtml(root, '[data-hg-faction-focus-field="orgNamePrimary"]', LORE_V9_REDACTED_SENTINEL),
    orgAccentHtml: takeInnerHtml(root, '[data-hg-faction-focus-field="orgNameAccent"]', LORE_V9_REDACTED_SENTINEL),
    recordHtml: takeInnerHtml(root, '[data-hg-faction-focus-record="true"]', DEFAULT_RECORD_HTML),
  };
}

export function factionBodyToFocusDocumentHtml(bodyHtml: string): string {
  const p = parseFactionArchive091BodyHtml(bodyHtml);
  if (!p) return bodyHtml;
  return buildFactionFocusDocumentHtml({
    orgPrimaryHtml: p.orgPrimaryInnerHtml,
    orgAccentHtml: p.orgAccentInnerHtml,
    recordHtml: p.recordInnerHtml,
  });
}

export function focusDocumentHtmlToFactionBody(focusHtml: string, canonicalTemplateHtml: string): string {
  const focusRoot = parseWrapped(focusHtml);
  const templateRails = parseFactionArchive091BodyHtml(canonicalTemplateHtml);
  if (!focusRoot || !templateRails) return canonicalTemplateHtml;

  const primary = takeInnerHtml(focusRoot, '[data-hg-faction-focus-field="orgNamePrimary"]', LORE_V9_REDACTED_SENTINEL);
  const accent = takeInnerHtml(focusRoot, '[data-hg-faction-focus-field="orgNameAccent"]', LORE_V9_REDACTED_SENTINEL);
  const record = takeInnerHtml(focusRoot, '[data-hg-faction-focus-record="true"]', DEFAULT_RECORD_HTML);

  return buildFactionArchive091BodyHtml({
    orgPrimaryInnerHtml: primary,
    orgAccentInnerHtml: accent,
    recordInnerHtml: record,
    railUpper: templateRails.railUpper,
    railLower: templateRails.railLower,
  });
}
