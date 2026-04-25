import { mediaUploadActionLabel } from "@/src/components/foundation/architectural-media-html";
import { HEARTGARDEN_MEDIA_PLACEHOLDER_SRC } from "@/src/lib/heartgarden-media-placeholder";
import { getLoreNodeSeedBodyHtml } from "@/src/lib/lore-node-seed-html";
import {
  sanitizedHtmlOrBr,
  sanitizeRichHtmlForEditor,
} from "@/src/lib/safe-html";

const DEFAULT_NOTES_HTML = "<p><br></p>";

function parseWrapped(html: string): HTMLElement | null {
  if (typeof DOMParser === "undefined") {
    return null;
  }
  try {
    const doc = new DOMParser().parseFromString(
      `<div id="__hg_cf_doc">${html}</div>`,
      "text/html"
    );
    return doc.getElementById("__hg_cf_doc");
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

function takeOuterHtml(root: ParentNode, selector: string): string | null {
  const el = root.querySelector<HTMLElement>(selector);
  return el?.outerHTML ?? null;
}

function takeAttr(
  root: ParentNode,
  selector: string,
  attr: string,
  fallback = ""
): string {
  const el = root.querySelector<HTMLElement>(selector);
  return el?.getAttribute(attr)?.trim() || fallback;
}

function hasAttr(root: ParentNode, selector: string, attr: string): boolean {
  const el = root.querySelector<HTMLElement>(selector);
  return !!el?.hasAttribute(attr);
}

function takeText(root: ParentNode, selector: string, fallback = ""): string {
  const el = root.querySelector<HTMLElement>(selector);
  const text = (el?.textContent || "").trim();
  return text || fallback;
}

function ensureVigilMediaUploadButtonClass(rawClass: string): string {
  const tokens = new Set(
    rawClass
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)
  );
  tokens.add("vigil-btn");
  return Array.from(tokens).join(" ");
}

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isEmptyEditableHtml(html: string): boolean {
  const stripped = html
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]*>/g, "")
    .trim();
  return stripped.length === 0;
}

function focusFieldHtml(root: ParentNode, selector: string): string {
  const raw = takeInnerHtml(root, selector, "");
  return isEmptyEditableHtml(raw) ? "" : raw;
}

function findLoreFieldByPlaceholder(
  root: ParentNode,
  placeholder: string
): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-hg-lore-ph="${placeholder}"]`);
}

function firstLoreField(
  root: ParentNode,
  predicate: (el: HTMLElement) => boolean
): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>("[data-hg-lore-field]")) {
    if (predicate(el)) {
      return el;
    }
  }
  return null;
}

function innerHtmlOrFallback(el: HTMLElement | null, fallback: string): string {
  if (!el) {
    return fallback;
  }
  const html = (el.innerHTML || "").trim();
  return html || fallback;
}

/**
 * Rebuild a character v11 body from stable data attributes so cards saved from another build/device
 * (different CSS-module hashes) regain the local style classes.
 */
export function normalizeCharacterV11BodyHtmlForCurrentBuild(
  bodyHtml: string
): string {
  const root = parseWrapped(bodyHtml);
  if (!root) {
    return bodyHtml;
  }

  const templateRoot = parseWrapped(
    getLoreNodeSeedBodyHtml("character", "v11")
  );
  if (!templateRoot) {
    return bodyHtml;
  }

  const allFields = [
    ...root.querySelectorAll<HTMLElement>("[data-hg-lore-field]"),
  ];
  if (allFields.length === 0) {
    return bodyHtml;
  }

  const header =
    root.querySelector<HTMLElement>("[data-hg-object-id-full]") ??
    root.querySelector<HTMLElement>(
      '[data-hg-lore-field][title="Catalog ID"]'
    ) ??
    firstLoreField(root, (el) => !el.hasAttribute("data-hg-lore-ph"));

  const notes =
    findLoreFieldByPlaceholder(root, "Notes") ??
    firstLoreField(root, (el) => el.querySelector("p") != null) ??
    allFields.at(-1) ??
    null;

  const claimed = new Set<HTMLElement>();
  if (header) {
    claimed.add(header);
  }
  if (notes) {
    claimed.add(notes);
  }

  const remaining = allFields.filter((el) => !claimed.has(el));
  const name = findLoreFieldByPlaceholder(root, "Name") ?? remaining[0] ?? null;
  const role = findLoreFieldByPlaceholder(root, "Role") ?? remaining[1] ?? null;
  const affiliation =
    findLoreFieldByPlaceholder(root, "Group") ?? remaining[2] ?? null;
  const nationality =
    findLoreFieldByPlaceholder(root, "Origin") ?? remaining[3] ?? null;

  setInnerHtml(
    templateRoot,
    '[class*="charSkHeaderMeta"]',
    innerHtmlOrFallback(header, "<br>")
  );
  setInnerHtml(
    templateRoot,
    '[class*="charSkDisplayName"]',
    innerHtmlOrFallback(name, "<br>")
  );
  setInnerHtml(
    templateRoot,
    '[class*="charSkRole"]',
    innerHtmlOrFallback(role, "<br>")
  );
  setInnerHtml(
    templateRoot,
    '[class*="charSkMetaRow"]:nth-of-type(1) [class*="charSkMetaValue"]',
    innerHtmlOrFallback(affiliation, "<br>")
  );
  setInnerHtml(
    templateRoot,
    '[class*="charSkMetaRow"]:nth-of-type(2) [class*="charSkMetaValue"]',
    innerHtmlOrFallback(nationality, "<br>")
  );
  setInnerHtml(
    templateRoot,
    '[class*="charSkNotesBody"]',
    innerHtmlOrFallback(notes, DEFAULT_NOTES_HTML)
  );

  const templatePortrait = templateRoot.querySelector<HTMLImageElement>(
    '[data-hg-lore-portrait-root="v11"] img'
  );
  const sourcePortrait = root.querySelector<HTMLImageElement>(
    '[data-hg-lore-portrait-root="v11"] img'
  );
  if (templatePortrait && sourcePortrait) {
    const src = sourcePortrait.getAttribute("src")?.trim() ?? "";
    const alt = sourcePortrait.getAttribute("alt") ?? "";
    if (src) {
      templatePortrait.setAttribute("src", src);
    }
    templatePortrait.setAttribute("alt", alt);
    const isPlaceholder =
      sourcePortrait.hasAttribute("data-hg-portrait-placeholder") ||
      sourcePortrait.hasAttribute("data-hg-heartgarden-media-placeholder") ||
      src === HEARTGARDEN_MEDIA_PLACEHOLDER_SRC;
    if (isPlaceholder) {
      templatePortrait.setAttribute("data-hg-portrait-placeholder", "true");
      templatePortrait.setAttribute(
        "data-hg-heartgarden-media-placeholder",
        "true"
      );
    } else {
      templatePortrait.removeAttribute("data-hg-portrait-placeholder");
      templatePortrait.removeAttribute("data-hg-heartgarden-media-placeholder");
    }
  }

  return templateRoot.innerHTML;
}

/**
 * Build a focus-first character document from canonical v11 credential HTML.
 * Output stays a single rich-editable body and keeps portrait upload hooks.
 */
export function characterV11BodyToFocusDocumentHtml(bodyHtml: string): string {
  const root = parseWrapped(bodyHtml);
  if (!root) {
    return bodyHtml;
  }

  const portraitRootHtml =
    takeOuterHtml(root, '[data-hg-lore-portrait-root="v11"]') ??
    `<div data-hg-lore-portrait-root="v11" contenteditable="false"></div>`;
  const portraitDoc = parseWrapped(portraitRootHtml);
  const portraitSrc = takeAttr(portraitDoc ?? root, "img", "src");
  const portraitAlt = takeAttr(portraitDoc ?? root, "img", "alt");
  const portraitClass = takeAttr(portraitDoc ?? root, "img", "class");
  const portraitUploadClass = takeAttr(
    portraitDoc ?? root,
    '[data-architectural-media-upload="true"]',
    "class"
  );
  const portraitUploadLabel = takeText(
    portraitDoc ?? root,
    '[data-architectural-media-upload="true"]',
    ""
  );
  const portraitUploadClassWithVigil =
    ensureVigilMediaUploadButtonClass(portraitUploadClass);
  const portraitIsPlaceholder =
    hasAttr(portraitDoc ?? root, "img", "data-hg-portrait-placeholder") ||
    portraitSrc === HEARTGARDEN_MEDIA_PLACEHOLDER_SRC;
  const displayName = focusFieldHtml(root, '[class*="charSkDisplayName"]');
  const role = focusFieldHtml(root, '[class*="charSkRole"]');
  const affiliation = focusFieldHtml(
    root,
    '[class*="charSkMetaRow"]:nth-of-type(1) [class*="charSkMetaValue"]'
  );
  const nationality = focusFieldHtml(
    root,
    '[class*="charSkMetaRow"]:nth-of-type(2) [class*="charSkMetaValue"]'
  );
  const notes = takeInnerHtml(
    root,
    '[class*="charSkNotesBody"]',
    DEFAULT_NOTES_HTML
  );

  return `<div data-hg-character-focus-doc="v1">
<div data-hg-character-focus-meta="true" contenteditable="false">
<div data-hg-character-focus-row="identity">
<div data-hg-character-focus-portrait="true" contenteditable="false">
<div data-hg-character-focus-portrait-frame="true" contenteditable="false">
<div data-architectural-media-root="true" data-hg-lore-portrait-root="v11" contenteditable="false">
<img data-hg-character-focus-portrait-img="true" class="${escapeAttr(portraitClass)}" src="${escapeAttr(portraitSrc)}" alt="${escapeAttr(portraitAlt)}" contenteditable="false" draggable="false"${portraitIsPlaceholder ? ' data-hg-portrait-placeholder="true" data-hg-heartgarden-media-placeholder="true"' : ""} />
<div data-hg-portrait-actions="true" contenteditable="false"><button type="button" class="${escapeAttr(portraitUploadClassWithVigil)}" data-variant="ghost" data-size="sm" data-tone="glass" data-architectural-media-upload="true">${portraitUploadLabel || mediaUploadActionLabel(!portraitIsPlaceholder && !!portraitSrc)}</button></div>
</div>
</div>
</div>
<div data-hg-character-focus-fields="true" contenteditable="false">
<div data-hg-character-focus-line="name"><span data-hg-character-focus-label="true">Name</span><div data-hg-character-focus-field="name" data-placeholder="Name" contenteditable="true" spellcheck="false">${displayName}</div></div>
<div data-hg-character-focus-line="role"><span data-hg-character-focus-label="true">Role</span><div data-hg-character-focus-field="role" data-placeholder="Role" contenteditable="true" spellcheck="false">${role}</div></div>
<div data-hg-character-focus-line="affiliation"><span data-hg-character-focus-label="true">Affiliation</span><div data-hg-character-focus-field="affiliation" data-placeholder="Affiliation" contenteditable="true" spellcheck="false">${affiliation}</div></div>
<div data-hg-character-focus-line="nationality"><span data-hg-character-focus-label="true">Nationality</span><div data-hg-character-focus-field="nationality" data-placeholder="Nationality" contenteditable="true" spellcheck="false">${nationality}</div></div>
</div>
</div>
</div>
<div data-hg-character-focus-notes-shell="true" contenteditable="false">
<span data-hg-character-focus-label="true">Notes</span>
<div data-hg-character-focus-notes="true" contenteditable="true" spellcheck="false">${notes}</div>
</div>
</div>`;
}

function setInnerHtml(root: ParentNode, selector: string, html: string) {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) {
    return;
  }
  const next = sanitizedHtmlOrBr(html);
  el.innerHTML = next;
}

function compactObjectIdForHeader(objectId: string): string {
  const normalized = objectId.toUpperCase();
  if (normalized.length <= 16) {
    return normalized;
  }
  return `${normalized.slice(0, 8)}-${normalized.slice(-6)}`;
}

/**
 * Merge focus document edits back into canonical v11 credential HTML.
 * Uses existing canonical HTML as the template to preserve hooks/classes.
 */
export function focusDocumentHtmlToCharacterV11Body(
  focusHtml: string,
  canonicalTemplateHtml: string,
  objectId: string
): string {
  const focusRoot = parseWrapped(focusHtml);
  const templateRoot = parseWrapped(canonicalTemplateHtml);
  if (!(focusRoot && templateRoot)) {
    return canonicalTemplateHtml;
  }

  const notes = takeInnerHtml(
    focusRoot,
    '[data-hg-character-focus-notes="true"]',
    DEFAULT_NOTES_HTML
  );
  const displayName = takeInnerHtml(
    focusRoot,
    '[data-hg-character-focus-field="name"]'
  );
  const role = takeInnerHtml(
    focusRoot,
    '[data-hg-character-focus-field="role"]'
  );
  const affiliation = takeInnerHtml(
    focusRoot,
    '[data-hg-character-focus-field="affiliation"]'
  );
  const nationality = takeInnerHtml(
    focusRoot,
    '[data-hg-character-focus-field="nationality"]'
  );

  setInnerHtml(
    templateRoot,
    '[class*="charSkHeaderMeta"]',
    objectId.toUpperCase()
  );
  setInnerHtml(templateRoot, '[class*="charSkDisplayName"]', displayName);
  setInnerHtml(templateRoot, '[class*="charSkRole"]', role);
  setInnerHtml(
    templateRoot,
    '[class*="charSkMetaRow"]:nth-of-type(1) [class*="charSkMetaValue"]',
    affiliation
  );
  setInnerHtml(
    templateRoot,
    '[class*="charSkMetaRow"]:nth-of-type(2) [class*="charSkMetaValue"]',
    nationality
  );
  setInnerHtml(templateRoot, '[class*="charSkNotesBody"]', notes);

  const nextPortraitSrc = takeAttr(
    focusRoot,
    '[data-hg-character-focus-portrait-img="true"]',
    "src"
  );
  const nextPortraitAlt = takeAttr(
    focusRoot,
    '[data-hg-character-focus-portrait-img="true"]',
    "alt"
  );
  const nextPortraitIsPlaceholder =
    hasAttr(
      focusRoot,
      '[data-hg-character-focus-portrait-img="true"]',
      "data-hg-portrait-placeholder"
    ) ||
    hasAttr(
      focusRoot,
      '[data-hg-character-focus-portrait-img="true"]',
      "data-hg-heartgarden-media-placeholder"
    ) ||
    nextPortraitSrc === HEARTGARDEN_MEDIA_PLACEHOLDER_SRC;
  if (nextPortraitSrc) {
    const templatePortraitRoot = templateRoot.querySelector<HTMLElement>(
      '[data-hg-lore-portrait-root="v11"]'
    );
    if (templatePortraitRoot) {
      let img = templatePortraitRoot.querySelector<HTMLImageElement>("img");
      if (!img) {
        const doc = templateRoot.ownerDocument ?? document;
        img = doc.createElement("img");
        templatePortraitRoot.prepend(img);
      }
      img.setAttribute("src", nextPortraitSrc);
      img.setAttribute("alt", nextPortraitAlt);
      if (nextPortraitIsPlaceholder) {
        img.setAttribute("data-hg-portrait-placeholder", "true");
        img.setAttribute("data-hg-heartgarden-media-placeholder", "true");
      } else {
        img.removeAttribute("data-hg-portrait-placeholder");
        img.removeAttribute("data-hg-heartgarden-media-placeholder");
      }
    }
  }
  return templateRoot.innerHTML;
}

/** Keep canonical v11 header meta aligned to backend object id. */
export function withCharacterV11ObjectIdInHeader(
  bodyHtml: string,
  objectId: string
): string {
  const root = parseWrapped(bodyHtml);
  if (!root) {
    return bodyHtml;
  }
  const headerMeta = root.querySelector<HTMLElement>(
    '[class*="charSkHeaderMeta"]'
  );
  if (headerMeta) {
    const full = objectId.toUpperCase();
    headerMeta.textContent = compactObjectIdForHeader(full);
    headerMeta.setAttribute("title", full);
    headerMeta.setAttribute("data-hg-object-id-full", full);
    headerMeta.setAttribute("contenteditable", "false");
    headerMeta.removeAttribute("data-hg-lore-field");
    headerMeta.removeAttribute("data-hg-lore-placeholder");
  }
  const portrait = root.querySelector<HTMLImageElement>(
    '[data-hg-lore-portrait-root="v11"] img'
  );
  if (portrait) {
    const src = portrait.getAttribute("src") ?? "";
    const widthAttr = portrait.getAttribute("width") ?? "";
    const heightAttr = portrait.getAttribute("height") ?? "";
    const legacyPlaceholderBySrc =
      src.includes("viewBox%3D%220%200%20120%20160%22") ||
      src.includes('viewBox="0 0 120 160"');
    const legacyPlaceholderByDims =
      src.startsWith("data:image/svg+xml") &&
      widthAttr === "240" &&
      heightAttr === "320";
    const shouldNormalizePlaceholder =
      portrait.hasAttribute("data-hg-portrait-placeholder") ||
      legacyPlaceholderBySrc ||
      legacyPlaceholderByDims;
    if (shouldNormalizePlaceholder) {
      portrait.setAttribute("src", HEARTGARDEN_MEDIA_PLACEHOLDER_SRC);
      portrait.setAttribute("width", "240");
      portrait.setAttribute("height", "180");
      portrait.setAttribute("data-hg-portrait-placeholder", "true");
      portrait.setAttribute("data-hg-heartgarden-media-placeholder", "true");
    }
  }
  return root.innerHTML;
}

/** Parsed character focus shell (`characterV11BodyToFocusDocumentHtml` shape) for hgDoc migration. */
export interface CharacterFocusParts {
  affiliation: string;
  displayName: string;
  nationality: string;
  notesHtml: string;
  portraitAlt: string;
  portraitClass: string;
  portraitIsPlaceholder: boolean;
  portraitSrc: string;
  portraitUploadClass: string;
  portraitUploadLabel: string;
  role: string;
}

function parseFocusShellRoot(html: string): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  try {
    const tpl = document.createElement("template");
    tpl.innerHTML = sanitizeRichHtmlForEditor(html.trim());
    const el = tpl.content.firstElementChild;
    return el instanceof HTMLElement ? el : null;
  } catch {
    return null;
  }
}

export function parseCharacterFocusDocumentHtml(
  html: string
): CharacterFocusParts | null {
  const root = parseFocusShellRoot(html);
  if (!root?.querySelector("[data-hg-character-focus-notes]")) {
    return null;
  }

  const portraitSrc = takeAttr(
    root,
    '[data-hg-character-focus-portrait-img="true"]',
    "src"
  );
  const portraitAlt = takeAttr(
    root,
    '[data-hg-character-focus-portrait-img="true"]',
    "alt"
  );
  const portraitClass = takeAttr(
    root,
    '[data-hg-character-focus-portrait-img="true"]',
    "class"
  );
  const portraitUploadClass = takeAttr(
    root,
    '[data-hg-portrait-actions="true"] [data-architectural-media-upload="true"]',
    "class"
  );
  const portraitUploadLabel = takeText(
    root,
    '[data-hg-portrait-actions="true"] [data-architectural-media-upload="true"]',
    ""
  );
  const portraitIsPlaceholder =
    hasAttr(
      root,
      '[data-hg-character-focus-portrait-img="true"]',
      "data-hg-portrait-placeholder"
    ) ||
    hasAttr(
      root,
      '[data-hg-character-focus-portrait-img="true"]',
      "data-hg-heartgarden-media-placeholder"
    ) ||
    portraitSrc === HEARTGARDEN_MEDIA_PLACEHOLDER_SRC;

  return {
    portraitSrc,
    portraitAlt,
    portraitClass,
    portraitUploadClass,
    portraitUploadLabel,
    portraitIsPlaceholder,
    displayName: takeInnerHtml(
      root,
      '[data-hg-character-focus-field="name"]',
      "<br>"
    ),
    role: takeInnerHtml(root, '[data-hg-character-focus-field="role"]', "<br>"),
    affiliation: takeInnerHtml(
      root,
      '[data-hg-character-focus-field="affiliation"]',
      "<br>"
    ),
    nationality: takeInnerHtml(
      root,
      '[data-hg-character-focus-field="nationality"]',
      "<br>"
    ),
    notesHtml: takeInnerHtml(
      root,
      "[data-hg-character-focus-notes]",
      DEFAULT_NOTES_HTML
    ),
  };
}

/** `data-hg-character-focus-row="identity"` outer HTML (portrait column + field column) for hybrid shell. */
export function extractCharacterIdentityRowHtml(html: string): string {
  if (typeof DOMParser === "undefined") {
    return "";
  }
  try {
    const doc = new DOMParser().parseFromString(
      `<div id="__hg_cf_identity">${html}</div>`,
      "text/html"
    );
    const root = doc.getElementById("__hg_cf_identity");
    const row = root?.querySelector('[data-hg-character-focus-row="identity"]');
    return row?.outerHTML ?? "";
  } catch {
    return "";
  }
}

/**
 * Read structured parts from a live identity row node. Pass `notesHtml` from TipTap (`hgDocToHtml`);
 * notes are not stored inside this row.
 */
export function readCharacterFocusPartsFromIdentityRow(
  row: HTMLElement,
  notesHtml: string
): CharacterFocusParts {
  const root = row as unknown as ParentNode;
  const portraitSrc = takeAttr(
    root,
    '[data-hg-character-focus-portrait-img="true"]',
    "src"
  );
  const portraitAlt = takeAttr(
    root,
    '[data-hg-character-focus-portrait-img="true"]',
    "alt"
  );
  const portraitClass = takeAttr(
    root,
    '[data-hg-character-focus-portrait-img="true"]',
    "class"
  );
  const portraitUploadClass = takeAttr(
    root,
    '[data-hg-portrait-actions="true"] [data-architectural-media-upload="true"]',
    "class"
  );
  const portraitUploadLabel = takeText(
    root,
    '[data-hg-portrait-actions="true"] [data-architectural-media-upload="true"]',
    ""
  );
  const portraitIsPlaceholder =
    hasAttr(
      root,
      '[data-hg-character-focus-portrait-img="true"]',
      "data-hg-portrait-placeholder"
    ) ||
    hasAttr(
      root,
      '[data-hg-character-focus-portrait-img="true"]',
      "data-hg-heartgarden-media-placeholder"
    ) ||
    portraitSrc === HEARTGARDEN_MEDIA_PLACEHOLDER_SRC;

  return {
    portraitSrc,
    portraitAlt,
    portraitClass,
    portraitUploadClass,
    portraitUploadLabel,
    portraitIsPlaceholder,
    displayName: takeInnerHtml(
      root,
      '[data-hg-character-focus-field="name"]',
      "<br>"
    ),
    role: takeInnerHtml(root, '[data-hg-character-focus-field="role"]', "<br>"),
    affiliation: takeInnerHtml(
      root,
      '[data-hg-character-focus-field="affiliation"]',
      "<br>"
    ),
    nationality: takeInnerHtml(
      root,
      '[data-hg-character-focus-field="nationality"]',
      "<br>"
    ),
    notesHtml,
  };
}

/** Rebuild focus document HTML from structured parts (matches `characterV11BodyToFocusDocumentHtml`). */
export function buildCharacterFocusDocumentHtml(
  parts: CharacterFocusParts
): string {
  const portraitIsPlaceholder = parts.portraitIsPlaceholder;
  const portraitUploadClassWithVigil = ensureVigilMediaUploadButtonClass(
    parts.portraitUploadClass
  );
  return `<div data-hg-character-focus-doc="v1">
<div data-hg-character-focus-meta="true" contenteditable="false">
<div data-hg-character-focus-row="identity">
<div data-hg-character-focus-portrait="true" contenteditable="false">
<div data-hg-character-focus-portrait-frame="true" contenteditable="false">
<div data-architectural-media-root="true" data-hg-lore-portrait-root="v11" contenteditable="false">
<img data-hg-character-focus-portrait-img="true" class="${escapeAttr(parts.portraitClass)}" src="${escapeAttr(parts.portraitSrc)}" alt="${escapeAttr(parts.portraitAlt)}" contenteditable="false" draggable="false"${portraitIsPlaceholder ? ' data-hg-portrait-placeholder="true" data-hg-heartgarden-media-placeholder="true"' : ""} />
<div data-hg-portrait-actions="true" contenteditable="false"><button type="button" class="${escapeAttr(portraitUploadClassWithVigil)}" data-variant="ghost" data-size="sm" data-tone="glass" data-architectural-media-upload="true">${parts.portraitUploadLabel || mediaUploadActionLabel(!portraitIsPlaceholder && !!parts.portraitSrc)}</button></div>
</div>
</div>
</div>
<div data-hg-character-focus-fields="true" contenteditable="false">
<div data-hg-character-focus-line="name"><span data-hg-character-focus-label="true">Name</span><div data-hg-character-focus-field="name" data-placeholder="Name" contenteditable="true" spellcheck="false">${parts.displayName}</div></div>
<div data-hg-character-focus-line="role"><span data-hg-character-focus-label="true">Role</span><div data-hg-character-focus-field="role" data-placeholder="Role" contenteditable="true" spellcheck="false">${parts.role}</div></div>
<div data-hg-character-focus-line="affiliation"><span data-hg-character-focus-label="true">Affiliation</span><div data-hg-character-focus-field="affiliation" data-placeholder="Affiliation" contenteditable="true" spellcheck="false">${parts.affiliation}</div></div>
<div data-hg-character-focus-line="nationality"><span data-hg-character-focus-label="true">Nationality</span><div data-hg-character-focus-field="nationality" data-placeholder="Nationality" contenteditable="true" spellcheck="false">${parts.nationality}</div></div>
</div>
</div>
</div>
<div data-hg-character-focus-notes-shell="true" contenteditable="false">
<span data-hg-character-focus-label="true">Notes</span>
<div data-hg-character-focus-notes="true" contenteditable="true" spellcheck="false">${parts.notesHtml}</div>
</div>
</div>`;
}
