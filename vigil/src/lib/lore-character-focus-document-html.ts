import { HEARTGARDEN_MEDIA_PLACEHOLDER_SRC } from "@/src/lib/heartgarden-media-placeholder";
import { mediaUploadActionLabel } from "@/src/components/foundation/architectural-media-html";

const DEFAULT_NOTES_HTML = "<p><br></p>";

function parseWrapped(html: string): HTMLElement | null {
  if (typeof DOMParser === "undefined") return null;
  try {
    const doc = new DOMParser().parseFromString(`<div id="__hg_cf_doc">${html}</div>`, "text/html");
    return doc.getElementById("__hg_cf_doc");
  } catch {
    return null;
  }
}

function takeInnerHtml(
  root: ParentNode,
  selector: string,
  fallback = "<br>",
): string {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) return fallback;
  const html = (el.innerHTML || "").trim();
  return html || fallback;
}

function takeOuterHtml(root: ParentNode, selector: string): string | null {
  const el = root.querySelector<HTMLElement>(selector);
  return el?.outerHTML ?? null;
}

function takeAttr(root: ParentNode, selector: string, attr: string, fallback = ""): string {
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
      .filter(Boolean),
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

/**
 * Build a focus-first character document from canonical v11 credential HTML.
 * Output stays a single rich-editable body and keeps portrait upload hooks.
 */
export function characterV11BodyToFocusDocumentHtml(bodyHtml: string): string {
  const root = parseWrapped(bodyHtml);
  if (!root) return bodyHtml;

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
    "class",
  );
  const portraitUploadLabel = takeText(portraitDoc ?? root, '[data-architectural-media-upload="true"]', "");
  const portraitUploadClassWithVigil = ensureVigilMediaUploadButtonClass(portraitUploadClass);
  const portraitIsPlaceholder =
    hasAttr(portraitDoc ?? root, "img", "data-hg-portrait-placeholder") ||
    portraitSrc === HEARTGARDEN_MEDIA_PLACEHOLDER_SRC;
  const displayName = focusFieldHtml(root, '[class*="charSkDisplayName"]');
  const role = focusFieldHtml(root, '[class*="charSkRole"]');
  const affiliation = focusFieldHtml(
    root,
    '[class*="charSkMetaRow"]:nth-of-type(1) [class*="charSkMetaValue"]',
  );
  const nationality = focusFieldHtml(
    root,
    '[class*="charSkMetaRow"]:nth-of-type(2) [class*="charSkMetaValue"]',
  );
  const notes = takeInnerHtml(root, '[class*="charSkNotesBody"]', DEFAULT_NOTES_HTML);

  return `<div data-hg-character-focus-doc="v1">
<div data-hg-character-focus-meta="true" contenteditable="false">
<div data-hg-character-focus-row="identity">
<div data-hg-character-focus-portrait="true" contenteditable="false">
<div data-hg-character-focus-portrait-frame="true" contenteditable="false">
<div data-architectural-media-root="true" data-hg-lore-portrait-root="v11" contenteditable="false">
<img data-hg-character-focus-portrait-img="true" class="${escapeAttr(portraitClass)}" src="${escapeAttr(portraitSrc)}" alt="${escapeAttr(portraitAlt)}" contenteditable="false" draggable="false"${portraitIsPlaceholder ? ' data-hg-portrait-placeholder="true"' : ""} />
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
  if (!el) return;
  const next = html.trim() ? html : "<br>";
  el.innerHTML = next;
}

function compactObjectIdForHeader(objectId: string): string {
  const normalized = objectId.toUpperCase();
  if (normalized.length <= 16) return normalized;
  return `${normalized.slice(0, 8)}-${normalized.slice(-6)}`;
}

/**
 * Merge focus document edits back into canonical v11 credential HTML.
 * Uses existing canonical HTML as the template to preserve hooks/classes.
 */
export function focusDocumentHtmlToCharacterV11Body(
  focusHtml: string,
  canonicalTemplateHtml: string,
  objectId: string,
): string {
  const focusRoot = parseWrapped(focusHtml);
  const templateRoot = parseWrapped(canonicalTemplateHtml);
  if (!focusRoot || !templateRoot) return canonicalTemplateHtml;

  const notes = takeInnerHtml(focusRoot, '[data-hg-character-focus-notes="true"]', DEFAULT_NOTES_HTML);
  const displayName = takeInnerHtml(focusRoot, '[data-hg-character-focus-field="name"]');
  const role = takeInnerHtml(focusRoot, '[data-hg-character-focus-field="role"]');
  const affiliation = takeInnerHtml(focusRoot, '[data-hg-character-focus-field="affiliation"]');
  const nationality = takeInnerHtml(focusRoot, '[data-hg-character-focus-field="nationality"]');

  setInnerHtml(templateRoot, '[class*="charSkHeaderMeta"]', objectId.toUpperCase());
  setInnerHtml(templateRoot, '[class*="charSkDisplayName"]', displayName);
  setInnerHtml(templateRoot, '[class*="charSkRole"]', role);
  setInnerHtml(
    templateRoot,
    '[class*="charSkMetaRow"]:nth-of-type(1) [class*="charSkMetaValue"]',
    affiliation,
  );
  setInnerHtml(
    templateRoot,
    '[class*="charSkMetaRow"]:nth-of-type(2) [class*="charSkMetaValue"]',
    nationality,
  );
  setInnerHtml(templateRoot, '[class*="charSkNotesBody"]', notes);

  const nextPortraitSrc = takeAttr(
    focusRoot,
    '[data-hg-character-focus-portrait-img="true"]',
    "src",
  );
  const nextPortraitAlt = takeAttr(
    focusRoot,
    '[data-hg-character-focus-portrait-img="true"]',
    "alt",
  );
  const nextPortraitIsPlaceholder =
    hasAttr(
      focusRoot,
      '[data-hg-character-focus-portrait-img="true"]',
      "data-hg-portrait-placeholder",
    ) || nextPortraitSrc === HEARTGARDEN_MEDIA_PLACEHOLDER_SRC;
  if (nextPortraitSrc) {
    const templatePortraitRoot = templateRoot.querySelector<HTMLElement>('[data-hg-lore-portrait-root="v11"]');
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
      } else {
        img.removeAttribute("data-hg-portrait-placeholder");
      }
    }
  }
  return templateRoot.innerHTML;
}

/** Keep canonical v11 header meta aligned to backend object id. */
export function withCharacterV11ObjectIdInHeader(bodyHtml: string, objectId: string): string {
  const root = parseWrapped(bodyHtml);
  if (!root) return bodyHtml;
  const headerMeta = root.querySelector<HTMLElement>('[class*="charSkHeaderMeta"]');
  if (headerMeta) {
    const full = objectId.toUpperCase();
    headerMeta.textContent = compactObjectIdForHeader(full);
    headerMeta.setAttribute("title", full);
    headerMeta.setAttribute("data-hg-object-id-full", full);
    headerMeta.removeAttribute("data-hg-lore-placeholder");
  }
  const portrait = root.querySelector<HTMLImageElement>(
    '[data-hg-lore-portrait-root="v11"] img',
  );
  if (portrait) {
    const src = portrait.getAttribute("src") ?? "";
    const widthAttr = portrait.getAttribute("width") ?? "";
    const heightAttr = portrait.getAttribute("height") ?? "";
    const legacyPlaceholderBySrc =
      src.includes("viewBox%3D%220%200%20120%20160%22") ||
      src.includes('viewBox="0 0 120 160"');
    const legacyPlaceholderByDims =
      src.startsWith("data:image/svg+xml") && widthAttr === "240" && heightAttr === "320";
    const shouldNormalizePlaceholder =
      portrait.hasAttribute("data-hg-portrait-placeholder") ||
      legacyPlaceholderBySrc ||
      legacyPlaceholderByDims;
    if (shouldNormalizePlaceholder) {
      portrait.setAttribute("src", HEARTGARDEN_MEDIA_PLACEHOLDER_SRC);
      portrait.setAttribute("width", "240");
      portrait.setAttribute("height", "180");
      portrait.setAttribute("data-hg-portrait-placeholder", "true");
    }
  }
  return root.innerHTML;
}
