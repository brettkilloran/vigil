/**
 * Location lore nodes: canonical canvas `bodyHtml` holds three structured lines
 * (name required; context + detail optional) plus long-form notes. Focus mode
 * projects to a single scroll surface; notes are hidden on the canvas (CSS).
 */

import { plainTextFromInlineHtmlFragment } from "@/src/lib/hg-doc/html-to-doc";
import {
  ORDO_V7_EMPTY_NAME_SENTINEL,
  splitOrdoV7DisplayName,
} from "@/src/lib/lore-location-ordo-display-name";
import {
  sanitizedHtmlOrBr,
  sanitizeRichHtmlForEditor,
} from "@/src/lib/safe-html";

const DEFAULT_NOTES_HTML = "<p><br></p>";

/** v11 `data-hg-lore-ph` caption for empty ORDO v7 placename (guest-check strip + ::before; not real title text). */
export const LORE_V11_PH_LOCATION_PLACEHOLDER = "PLACENAME";

export const LOCATION_TOP_FIELD_CHAR_CAPS = {
  context: 72,
  detail: 96,
  name: 64,
} as const;

export type LocationTopFieldKey = keyof typeof LOCATION_TOP_FIELD_CHAR_CAPS;

/** Legacy v2/v3 seed HTML used this literal in `[data-hg-lore-location-field="name"]` — not a real placename. */
const LEGACY_LOC_SEED_PLACEHOLDER_LABEL = /^place name$/i;
const LEGACY_LOC_SEED_PLACEHOLDER_PREFIX_SP = /^place name\s+/i;
/** User typed after the seed label without deleting it first (no space before the real title). */
const LEGACY_LOC_SEED_PLACEHOLDER_PREFIX_GLUE = /^place name(?=[A-Z0-9])/i;
const LEGACY_LOC_SEED_PLACEHOLDER_PREFIX_GLUE_REPLACE = /^place name/i;

function escapeHtmlLocationNamePlain(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Strip legacy seed / edit artifacts so "Place name" is not treated as part of the placename.
 * Exported for tests and any call sites that mirror title extraction.
 */
export function stripLegacyLoreLocationSeedPlaceNameLabel(
  plain: string
): string {
  const t = plain.replace(/\s+/g, " ").trim();
  if (!t) {
    return "";
  }
  if (LEGACY_LOC_SEED_PLACEHOLDER_LABEL.test(t)) {
    return "";
  }
  if (LEGACY_LOC_SEED_PLACEHOLDER_PREFIX_SP.test(t)) {
    return t.replace(LEGACY_LOC_SEED_PLACEHOLDER_PREFIX_SP, "").trim();
  }
  if (LEGACY_LOC_SEED_PLACEHOLDER_PREFIX_GLUE.test(t)) {
    return t
      .replace(LEGACY_LOC_SEED_PLACEHOLDER_PREFIX_GLUE_REPLACE, "")
      .trim();
  }
  return t;
}

function buildLocationNameFieldInnerHtmlFromPlainCore(coreRaw: string): string {
  const core = normalizeLocOrdoV7NameField(coreRaw.replace(/\s+/g, " ").trim());
  if (!core) {
    return "<br>";
  }
  const { line1, line2 } = splitOrdoV7DisplayName(core);
  if (line2) {
    return `${escapeHtmlLocationNamePlain(line1)}<br />${escapeHtmlLocationNamePlain(line2)}`;
  }
  return escapeHtmlLocationNamePlain(line1);
}

/** Normalize stored/plain name: empty, PLACENAME caption, or splitOrdoV7 empty sentinel → "". */
export function normalizeLocOrdoV7NameField(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) {
    return "";
  }
  if (t.toUpperCase() === LORE_V11_PH_LOCATION_PLACEHOLDER.toUpperCase()) {
    return "";
  }
  if (t.toUpperCase() === ORDO_V7_EMPTY_NAME_SENTINEL.toUpperCase()) {
    return "";
  }
  return t;
}

export function normalizeLocationTopFieldPlain(
  field: LocationTopFieldKey,
  raw: string
): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (field === "name") {
    return normalizeLocOrdoV7NameField(collapsed);
  }
  return collapsed;
}

export function trimLocationTopFieldForImport(
  field: LocationTopFieldKey,
  raw: string
): {
  value: string;
  wasTrimmed: boolean;
  cap: number;
} {
  const normalized = normalizeLocationTopFieldPlain(field, raw);
  const cap = LOCATION_TOP_FIELD_CHAR_CAPS[field];
  if (normalized.length <= cap) {
    return { cap, value: normalized, wasTrimmed: false };
  }
  return {
    cap,
    value: normalized.slice(0, cap).trimEnd(),
    wasTrimmed: true,
  };
}

function readLocationTopFieldPlainFromElement(
  field: LocationTopFieldKey,
  el: HTMLElement
): string {
  const domText =
    typeof el.innerText === "string" ? el.innerText : (el.textContent ?? "");
  const raw = field === "name" ? domText.replace(/\n/g, " ") : domText;
  return normalizeLocationTopFieldPlain(field, raw);
}

function selectionWithinElement(sel: Selection, el: HTMLElement): boolean {
  return (
    !!sel.anchorNode &&
    !!sel.focusNode &&
    el.contains(sel.anchorNode) &&
    el.contains(sel.focusNode)
  );
}

function selectedPlainLengthInElement(
  field: LocationTopFieldKey,
  el: HTMLElement
): number {
  const sel = el.ownerDocument.getSelection();
  if (!sel || sel.rangeCount === 0 || !selectionWithinElement(sel, el)) {
    return 0;
  }
  const selectedRaw =
    field === "name" ? sel.toString().replace(/\n/g, " ") : sel.toString();
  return normalizeLocationTopFieldPlain(field, selectedRaw).length;
}

function isDeletionInputType(inputType: string): boolean {
  return inputType.startsWith("delete");
}

function isInsertionInputType(inputType: string): boolean {
  return inputType.startsWith("insert");
}

function normalizedInsertionTextForBeforeInput(
  field: LocationTopFieldKey,
  event: InputEvent
): string {
  if (
    event.inputType === "insertParagraph" ||
    event.inputType === "insertLineBreak"
  ) {
    return " ";
  }
  const raw = event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
  return normalizeLocationTopFieldPlain(field, raw);
}

function maxInsertLength(
  field: LocationTopFieldKey,
  currentLength: number,
  baseLength: number
): number {
  const cap = LOCATION_TOP_FIELD_CHAR_CAPS[field];
  if (currentLength > cap) {
    // Legacy over-limit content is allowed to remain, but new insertions must not grow it further.
    return Math.max(0, currentLength - baseLength);
  }
  return Math.max(0, cap - baseLength);
}

export function shouldBlockLocationTopFieldBeforeInput(
  field: LocationTopFieldKey,
  el: HTMLElement,
  event: InputEvent
): boolean {
  if (isDeletionInputType(event.inputType)) {
    return false;
  }
  if (!isInsertionInputType(event.inputType)) {
    return false;
  }
  const currentLength = readLocationTopFieldPlainFromElement(field, el).length;
  const selectedLength = Math.min(
    currentLength,
    selectedPlainLengthInElement(field, el)
  );
  const baseLength = Math.max(0, currentLength - selectedLength);
  const incomingLength = normalizedInsertionTextForBeforeInput(
    field,
    event
  ).length;
  return incomingLength > maxInsertLength(field, currentLength, baseLength);
}

export function computeLocationTopFieldPasteInsertText(
  field: LocationTopFieldKey,
  el: HTMLElement,
  rawClipboardText: string
): string {
  const incoming = normalizeLocationTopFieldPlain(field, rawClipboardText);
  if (!incoming) {
    return "";
  }
  const currentLength = readLocationTopFieldPlainFromElement(field, el).length;
  const selectedLength = Math.min(
    currentLength,
    selectedPlainLengthInElement(field, el)
  );
  const baseLength = Math.max(0, currentLength - selectedLength);
  const maxLen = maxInsertLength(field, currentLength, baseLength);
  if (maxLen <= 0) {
    return "";
  }
  return incoming.slice(0, maxLen);
}

export function insertPlainTextIntoContentEditable(
  el: HTMLElement,
  text: string
): void {
  if (!text) {
    return;
  }
  el.focus();
  const doc = el.ownerDocument;
  try {
    if (
      typeof doc.execCommand === "function" &&
      doc.execCommand("insertText", false, text)
    ) {
      return;
    }
  } catch {
    // Fall through to manual range insertion.
  }
  const sel = doc.getSelection();
  if (!sel || sel.rangeCount === 0 || !selectionWithinElement(sel, el)) {
    el.appendChild(doc.createTextNode(text));
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(doc.createTextNode(text));
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function parseWrapped(html: string): HTMLElement | null {
  if (typeof DOMParser === "undefined") {
    return null;
  }
  try {
    const doc = new DOMParser().parseFromString(
      `<div id="__hg_loc_doc">${html}</div>`,
      "text/html"
    );
    return doc.getElementById("__hg_loc_doc");
  } catch {
    return null;
  }
}

function takeInnerHtml(
  root: ParentNode,
  selector: string,
  fallback = "<br>"
): string {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) {
    return fallback;
  }
  const html = sanitizeRichHtmlForEditor(el.innerHTML || "").trim();
  return html || fallback;
}

/**
 * Strip legacy literal `Place name` when it was a seed label or edit artifact; otherwise preserve
 * `innerHTML` (casing, inline markup, legacy cards).
 */
function locationNameFieldInnerHtmlAfterLegacyPlaceNameStrip(
  el: HTMLElement,
  fallback: string
): string {
  const plain = plainTextFromInlineHtmlFragment(el.innerHTML || "");
  const stripped = stripLegacyLoreLocationSeedPlaceNameLabel(plain);
  if (stripped !== plain) {
    return buildLocationNameFieldInnerHtmlFromPlainCore(stripped);
  }
  const raw = sanitizeRichHtmlForEditor(el.innerHTML || "").trim();
  return raw || fallback;
}

/** Focus + merge: normalize saved/live focus name field when it still contains the legacy seed label. */
function normalizedLocationFocusNameInnerFromFieldEl(
  el: HTMLElement | null,
  fallback = "<br>"
): string {
  if (!el) {
    return fallback;
  }
  return locationNameFieldInnerHtmlAfterLegacyPlaceNameStrip(el, fallback);
}

function normalizedLocationFocusNameInnerFromRoot(root: ParentNode): string {
  const el = root.querySelector<HTMLElement>(
    '[data-hg-lore-location-focus-field="name"]'
  );
  return normalizedLocationFocusNameInnerFromFieldEl(
    el,
    takeInnerHtml(root, '[data-hg-lore-location-focus-field="name"]', "<br>")
  );
}

/** Plain text for graph title — required line is `name`. */
export function plainPlaceNameFromLocationBodyHtml(bodyHtml: string): string {
  const root = parseWrapped(bodyHtml);
  if (!root) {
    return "";
  }
  const modern = root.querySelector<HTMLElement>(
    '[data-hg-lore-location-field="name"]'
  );
  if (modern) {
    const t = stripLegacyLoreLocationSeedPlaceNameLabel(
      plainTextFromInlineHtmlFragment(modern.innerHTML || "")
    );
    return normalizeLocOrdoV7NameField(t);
  }
  const legacy = root.querySelector<HTMLElement>('[class*="locName"]');
  if (legacy) {
    const t = stripLegacyLoreLocationSeedPlaceNameLabel(
      plainTextFromInlineHtmlFragment(legacy.innerHTML || "")
    );
    return normalizeLocOrdoV7NameField(t);
  }
  return "";
}

function extractNameHtml(root: ParentNode): string {
  const el = root.querySelector<HTMLElement>(
    '[data-hg-lore-location-field="name"]'
  );
  if (el) {
    return locationNameFieldInnerHtmlAfterLegacyPlaceNameStrip(el, "<br>");
  }
  const legacy = root.querySelector<HTMLElement>('[class*="locName"]');
  if (legacy) {
    return locationNameFieldInnerHtmlAfterLegacyPlaceNameStrip(legacy, "<br>");
  }
  return "<br>";
}

function extractContextHtml(root: ParentNode): string {
  const el = root.querySelector<HTMLElement>(
    '[data-hg-lore-location-field="context"]'
  );
  if (el) {
    const raw = (el.innerHTML || "").trim();
    return raw || "<br>";
  }
  const lines = root.querySelectorAll<HTMLElement>(
    '[class*="locHeader"] [class*="locMetaLine"]'
  );
  if (lines.length === 0) {
    return "<br>";
  }
  const first = lines[0]!;
  const spans = first.querySelectorAll("span");
  if (spans.length >= 2) {
    const val = Array.from(spans).at(-1) as HTMLElement;
    const raw = (val.innerHTML || "").trim();
    return raw || "<br>";
  }
  const raw = (first.innerHTML || "").trim();
  return raw || "<br>";
}

function extractDetailHtml(root: ParentNode): string {
  const el = root.querySelector<HTMLElement>(
    '[data-hg-lore-location-field="detail"]'
  );
  if (el) {
    const raw = (el.innerHTML || "").trim();
    return raw || "<br>";
  }
  const lines = root.querySelectorAll<HTMLElement>(
    '[class*="locHeader"] [class*="locMetaLine"]'
  );
  if (lines.length < 2) {
    return "<br>";
  }
  const second = lines[1]!;
  const spans = second.querySelectorAll("span");
  if (spans.length >= 2) {
    const val = Array.from(spans).at(-1) as HTMLElement;
    const raw = (val.innerHTML || "").trim();
    return raw || "<br>";
  }
  const raw = (second.innerHTML || "").trim();
  return raw || "<br>";
}

function extractRefHtml(root: ParentNode): string {
  const el = root.querySelector<HTMLElement>(
    '[data-hg-lore-location-field="ref"]'
  );
  if (el) {
    const raw = (el.innerHTML || "").trim();
    return raw || "<br>";
  }
  const legacy = root.querySelector<HTMLElement>('[class*="plaqueCorner"]');
  if (legacy) {
    const raw = (legacy.innerHTML || "").trim();
    return raw || "<br>";
  }
  return "<br>";
}

function extractNotesHtml(root: ParentNode): string {
  const el = root.querySelector<HTMLElement>(
    '[data-hg-lore-location-notes="true"]'
  );
  if (el) {
    return takeInnerHtml(
      root,
      '[data-hg-lore-location-notes="true"]',
      DEFAULT_NOTES_HTML
    );
  }
  return takeInnerHtml(root, '[class*="notesText"]', DEFAULT_NOTES_HTML);
}

function hasRefInTemplate(root: ParentNode): boolean {
  return !!root.querySelector(
    '[data-hg-lore-location-field="ref"], [class*="plaqueCorner"]'
  );
}

/**
 * Build focus document HTML from canonical location body (modern or legacy).
 */
export function locationBodyToFocusDocumentHtml(bodyHtml: string): string {
  const root = parseWrapped(bodyHtml);
  if (!root) {
    return bodyHtml;
  }

  const name = extractNameHtml(root);
  const context = extractContextHtml(root);
  const detail = extractDetailHtml(root);
  const notes = extractNotesHtml(root);
  const showRef = hasRefInTemplate(root);
  const ref = showRef ? extractRefHtml(root) : "";

  const refBlock = showRef
    ? `<div data-hg-lore-location-focus-row="ref">
<span data-hg-lore-location-focus-label="true">Reference</span>
<div data-hg-lore-location-focus-field="ref" data-placeholder="Optional code" contenteditable="true" spellcheck="false">${ref}</div>
</div>`
    : "";

  return `<div data-hg-location-focus-doc="v1">
<div data-hg-lore-location-focus-meta="true" contenteditable="false">
<div data-hg-lore-location-focus-row="name">
<span data-hg-lore-location-focus-label="true">Place</span>
<div data-hg-lore-location-focus-field="name" data-placeholder="Place name" contenteditable="true" spellcheck="false">${name}</div>
</div>
<div data-hg-lore-location-focus-row="context">
<span data-hg-lore-location-focus-label="true">Context</span>
<div data-hg-lore-location-focus-field="context" data-placeholder="Region, polity, parent place (optional)" contenteditable="true" spellcheck="false">${context}</div>
</div>
<div data-hg-lore-location-focus-row="detail">
<span data-hg-lore-location-focus-label="true">Detail</span>
<div data-hg-lore-location-focus-field="detail" data-placeholder="District, site type, layer (optional)" contenteditable="true" spellcheck="false">${detail}</div>
</div>
${refBlock}
</div>
<div data-hg-lore-location-focus-notes-shell="true" contenteditable="false">
<span data-hg-lore-location-focus-label="true">Notes</span>
<div data-hg-lore-location-focus-notes="true" contenteditable="true" spellcheck="false">${notes}</div>
</div>
</div>`;
}

function setInnerHtml(root: ParentNode, selector: string, html: string) {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) {
    return;
  }
  el.innerHTML = sanitizedHtmlOrBr(html);
}

function mergeIntoModernTemplate(
  templateRoot: ParentNode,
  name: string,
  context: string,
  detail: string,
  ref: string | undefined,
  notes: string
) {
  setInnerHtml(templateRoot, '[data-hg-lore-location-field="name"]', name);
  setInnerHtml(
    templateRoot,
    '[data-hg-lore-location-field="context"]',
    context
  );
  setInnerHtml(templateRoot, '[data-hg-lore-location-field="detail"]', detail);
  if (ref !== undefined) {
    setInnerHtml(templateRoot, '[data-hg-lore-location-field="ref"]', ref);
  }
  setInnerHtml(templateRoot, '[data-hg-lore-location-notes="true"]', notes);
}

function mergeIntoLegacyTemplate(
  templateRoot: ParentNode,
  name: string,
  context: string,
  detail: string,
  ref: string | undefined,
  notes: string
) {
  setInnerHtml(templateRoot, '[class*="locName"]', name);

  const lines = templateRoot.querySelectorAll<HTMLElement>(
    '[class*="locHeader"] [class*="locMetaLine"]'
  );
  if (lines.length >= 1) {
    const first = lines[0]!;
    const ctxField = first.querySelector<HTMLElement>(
      '[data-hg-lore-location-field="context"]'
    );
    if (ctxField) {
      ctxField.innerHTML = sanitizedHtmlOrBr(context);
    } else {
      const spans = first.querySelectorAll("span");
      if (spans.length >= 2) {
        // biome-ignore lint/style/useAtIndex: NodeListOf<Element> lacks `.at()` in this TS lib version
        const val = spans[spans.length - 1] as HTMLElement;
        val.innerHTML = sanitizedHtmlOrBr(context);
      } else {
        first.innerHTML = sanitizedHtmlOrBr(context);
      }
    }
  }
  if (lines.length >= 2) {
    const second = lines[1]!;
    const detailField = second.querySelector<HTMLElement>(
      '[data-hg-lore-location-field="detail"]'
    );
    if (detailField) {
      detailField.innerHTML = sanitizedHtmlOrBr(detail);
    } else {
      const spans = second.querySelectorAll("span");
      if (spans.length >= 2) {
        // biome-ignore lint/style/useAtIndex: NodeListOf<Element> lacks `.at()` in this TS lib version
        const val = spans[spans.length - 1] as HTMLElement;
        val.innerHTML = sanitizedHtmlOrBr(detail);
      } else {
        second.innerHTML = sanitizedHtmlOrBr(detail);
      }
    }
  }

  if (ref !== undefined) {
    const refEl =
      templateRoot.querySelector<HTMLElement>(
        '[data-hg-lore-location-field="ref"]'
      ) ?? templateRoot.querySelector<HTMLElement>('[class*="plaqueCorner"]');
    if (refEl) {
      refEl.innerHTML = sanitizedHtmlOrBr(ref);
    }
  }

  const notesEl = templateRoot.querySelector<HTMLElement>(
    '[data-hg-lore-location-notes="true"]'
  );
  if (notesEl) {
    notesEl.innerHTML = sanitizedHtmlOrBr(notes);
  } else {
    setInnerHtml(templateRoot, '[class*="notesText"]', notes);
  }
}

/**
 * Merge focus document edits back into canonical location body HTML.
 */
export function focusDocumentHtmlToLocationBody(
  focusHtml: string,
  canonicalTemplateHtml: string
): string {
  const focusRoot = parseWrapped(focusHtml);
  const templateRoot = parseWrapped(canonicalTemplateHtml);
  if (!(focusRoot && templateRoot)) {
    return canonicalTemplateHtml;
  }

  const name = normalizedLocationFocusNameInnerFromRoot(focusRoot);
  const context = takeInnerHtml(
    focusRoot,
    '[data-hg-lore-location-focus-field="context"]',
    "<br>"
  );
  const detail = takeInnerHtml(
    focusRoot,
    '[data-hg-lore-location-focus-field="detail"]',
    "<br>"
  );
  let notes = takeInnerHtml(
    focusRoot,
    '[data-hg-lore-location-focus-notes="true"]',
    DEFAULT_NOTES_HTML
  );
  const refField = focusRoot.querySelector(
    '[data-hg-lore-location-focus-field="ref"]'
  );
  const ref = refField
    ? takeInnerHtml(
        focusRoot,
        '[data-hg-lore-location-focus-field="ref"]',
        "<br>"
      )
    : undefined;
  const notesAlreadyIncludeRef = notes.includes(
    'data-hg-loc-ref-migrated="true"'
  );
  const refInline = (ref ?? "").trim();
  if (!notesAlreadyIncludeRef && refInline && refInline !== "<br>") {
    notes =
      `<p data-hg-loc-ref-migrated="true"><strong>Reference:</strong> ${sanitizeRichHtmlForEditor(refInline)}</p>` +
      notes;
  }

  if (templateRoot.querySelector('[data-hg-lore-location-field="name"]')) {
    mergeIntoModernTemplate(templateRoot, name, context, detail, ref, notes);
  } else {
    mergeIntoLegacyTemplate(templateRoot, name, context, detail, ref, notes);
  }

  return templateRoot.innerHTML;
}

/** Parsed location focus shell (`locationBodyToFocusDocumentHtml` shape) for hgDoc migration. */
export interface LocationFocusParts {
  context: string;
  detail: string;
  hasRef: boolean;
  name: string;
  notesHtml: string;
  ref: string;
}

export function parseLocationFocusDocumentHtml(
  html: string
): LocationFocusParts | null {
  const root = parseWrapped(html);
  if (!root?.querySelector("[data-hg-lore-location-focus-notes]")) {
    return null;
  }
  const refField = root.querySelector(
    '[data-hg-lore-location-focus-field="ref"]'
  );
  const hasRef = !!refField;
  return {
    context: takeInnerHtml(
      root,
      '[data-hg-lore-location-focus-field="context"]',
      "<br>"
    ),
    detail: takeInnerHtml(
      root,
      '[data-hg-lore-location-focus-field="detail"]',
      "<br>"
    ),
    hasRef,
    name: normalizedLocationFocusNameInnerFromRoot(root),
    notesHtml: takeInnerHtml(
      root,
      "[data-hg-lore-location-focus-notes]",
      DEFAULT_NOTES_HTML
    ),
    ref: refField
      ? takeInnerHtml(root, '[data-hg-lore-location-focus-field="ref"]', "<br>")
      : "",
  };
}

function locationFocusRefRowHtml(parts: LocationFocusParts): string {
  if (!parts.hasRef) {
    return "";
  }
  return `<div data-hg-lore-location-focus-row="ref">
<span data-hg-lore-location-focus-label="true">Reference</span>
<div data-hg-lore-location-focus-field="ref" data-placeholder="Optional code" contenteditable="true" spellcheck="false">${parts.ref}</div>
</div>`;
}

/** Inner `[data-hg-lore-location-focus-meta]` block (Place / Context / Detail / optional Reference). */
function buildLocationFocusMetaBlockHtml(parts: LocationFocusParts): string {
  return `<div data-hg-lore-location-focus-meta="true" contenteditable="false">
<div data-hg-lore-location-focus-row="name">
<span data-hg-lore-location-focus-label="true">Place</span>
<div data-hg-lore-location-focus-field="name" data-placeholder="Place name" contenteditable="true" spellcheck="false">${parts.name}</div>
</div>
<div data-hg-lore-location-focus-row="context">
<span data-hg-lore-location-focus-label="true">Context</span>
<div data-hg-lore-location-focus-field="context" data-placeholder="Region, polity, parent place (optional)" contenteditable="true" spellcheck="false">${parts.context}</div>
</div>
<div data-hg-lore-location-focus-row="detail">
<span data-hg-lore-location-focus-label="true">Detail</span>
<div data-hg-lore-location-focus-field="detail" data-placeholder="District, site type, layer (optional)" contenteditable="true" spellcheck="false">${parts.detail}</div>
</div>
${locationFocusRefRowHtml(parts)}
</div>`;
}

/**
 * Place/Context/Detail/Reference shell for hybrid editors: same DOM + data attributes as the focus
 * document, without the embedded Notes region (TipTap owns notes).
 */
export function buildLocationFocusMetaShellHtml(
  parts: LocationFocusParts
): string {
  return `<div data-hg-location-focus-doc="v1">${buildLocationFocusMetaBlockHtml(parts)}</div>`;
}

/**
 * Extract meta shell from a full focus document string (for injecting into the hybrid shell on node switch).
 */
export function extractLocationMetaFocusShellHtml(html: string): string {
  if (typeof DOMParser === "undefined") {
    return "";
  }
  try {
    const doc = new DOMParser().parseFromString(
      `<div id="__hg_loc_meta">${html}</div>`,
      "text/html"
    );
    const root = doc.getElementById("__hg_loc_meta");
    const meta = root?.querySelector(
      '[data-hg-lore-location-focus-meta="true"]'
    );
    if (!meta) {
      return "";
    }
    const nameField = meta.querySelector<HTMLElement>(
      '[data-hg-lore-location-focus-field="name"]'
    );
    if (nameField) {
      nameField.innerHTML = sanitizeRichHtmlForEditor(
        normalizedLocationFocusNameInnerFromFieldEl(nameField, "<br>")
      );
    }
    return `<div data-hg-location-focus-doc="v1">${meta.outerHTML}</div>`;
  } catch {
    return "";
  }
}

/** Read structured fields from a live `[data-hg-lore-location-focus-meta]` node; `notesHtml` comes from TipTap. */
export function readLocationFocusPartsFromMetaHost(
  metaHost: HTMLElement,
  notesHtml: string
): LocationFocusParts {
  const root = metaHost as unknown as ParentNode;
  const refField = root.querySelector(
    '[data-hg-lore-location-focus-field="ref"]'
  );
  const hasRef = !!refField;
  return {
    context: takeInnerHtml(
      root,
      '[data-hg-lore-location-focus-field="context"]',
      "<br>"
    ),
    detail: takeInnerHtml(
      root,
      '[data-hg-lore-location-focus-field="detail"]',
      "<br>"
    ),
    hasRef,
    name: normalizedLocationFocusNameInnerFromFieldEl(
      root.querySelector<HTMLElement>(
        '[data-hg-lore-location-focus-field="name"]'
      )
    ),
    notesHtml,
    ref: refField
      ? takeInnerHtml(root, '[data-hg-lore-location-focus-field="ref"]', "<br>")
      : "",
  };
}

export function buildLocationFocusDocumentHtml(
  parts: LocationFocusParts
): string {
  return `<div data-hg-location-focus-doc="v1">${buildLocationFocusMetaBlockHtml(parts)}
<div data-hg-lore-location-focus-notes-shell="true" contenteditable="false">
<span data-hg-lore-location-focus-label="true">Notes</span>
<div data-hg-lore-location-focus-notes="true" contenteditable="true" spellcheck="false">${parts.notesHtml}</div>
</div>
</div>`;
}

/** Plain-text fields + notes HTML fragment for hydrating `LoreLocationOrdoV7Slab` from canonical `bodyHtml`. */
export function parseLocationOrdoV7BodyPlainFields(bodyHtml: string): {
  name: string;
  context: string;
  detail: string;
  notesHtml: string;
} {
  const root = parseWrapped(bodyHtml);
  if (!root) {
    return { context: "", detail: "", name: "", notesHtml: DEFAULT_NOTES_HTML };
  }
  const nameEl = root.querySelector<HTMLElement>(
    '[data-hg-lore-location-field="name"]'
  );
  const name = normalizeLocOrdoV7NameField(
    stripLegacyLoreLocationSeedPlaceNameLabel(
      plainTextFromInlineHtmlFragment(nameEl?.innerHTML || "")
    )
  );
  const ctxEl = root.querySelector<HTMLElement>(
    '[data-hg-lore-location-field="context"]'
  );
  const context = plainTextFromInlineHtmlFragment(ctxEl?.innerHTML || "");
  const detEl = root.querySelector<HTMLElement>(
    '[data-hg-lore-location-field="detail"]'
  );
  const detail = plainTextFromInlineHtmlFragment(detEl?.innerHTML || "");
  const notesHtml = extractNotesHtml(root);
  return { context, detail, name, notesHtml };
}
