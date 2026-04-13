/**
 * Media cards embed a marked block in `bodyHtml` so we can replace the raster
 * after local file pick. Data URLs keep the foundation demo self-contained; a
 * real app would upload to storage and persist an HTTPS `src` instead.
 */
import {
  HEARTGARDEN_MEDIA_PLACEHOLDER_SRC,
  HG_MEDIA_PLACEHOLDER_ATTR,
  isHeartgardenMediaPlaceholderSrc,
} from "@/src/lib/heartgarden-media-placeholder";

const MEDIA_ROOT_SEL = "[data-architectural-media-root]";
const MEDIA_NOTES_SEL = "[data-architectural-media-notes]";
const MEDIA_UPLOAD_BTN_SEL = "[data-architectural-media-upload]";

export function mediaUploadActionLabel(hasImage: boolean): "Upload" | "Replace" {
  return hasImage ? "Replace" : "Upload";
}

function buildMediaUploadButtonClass(uploadButtonClass?: string): string {
  const tokens = new Set(
    (uploadButtonClass || "")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean),
  );
  tokens.add("vigil-btn");
  return Array.from(tokens).join(" ");
}

/** First `<img …>` in `html` (SSR-safe; mirrors `querySelector("img")` on a small fragment). */
function parseFirstImgFromHtmlFragment(html: string): { src: string | null; alt: string } {
  const imgMatch = html.match(/<img\b[^>]*>/i);
  if (!imgMatch) return { src: null, alt: "" };
  const tag = imgMatch[0];
  const srcQuoted = /\bsrc\s*=\s*["']([^"']*)["']/i.exec(tag);
  const srcUnquoted = !srcQuoted ? /\bsrc\s*=\s*([^\s>]+)/i.exec(tag) : null;
  const rawSrc = srcQuoted?.[1] ?? srcUnquoted?.[1] ?? null;
  const src = rawSrc != null && rawSrc.length > 0 ? rawSrc : null;
  const altQuoted = /\balt\s*=\s*["']([^"']*)["']/i.exec(tag);
  const altUnquoted = !altQuoted ? /\balt\s*=\s*([^\s>]+)/i.exec(tag) : null;
  const alt = altQuoted?.[1] ?? altUnquoted?.[1] ?? "";
  return { src, alt };
}

/**
 * Same result with or without `document` / DOMParser (SSR + client), so media cards hydrate consistently.
 */
export function parseArchitecturalMediaFromBody(bodyHtml: string): {
  src: string | null;
  alt: string;
} {
  const rootOpen = /<[^>]*\bdata-architectural-media-root\s*=\s*(?:"true"|'true'|true)\b[^>]*>/i.exec(
    bodyHtml,
  );
  if (rootOpen && rootOpen.index !== undefined) {
    const inner = bodyHtml.slice(rootOpen.index + rootOpen[0].length);
    const parsed = parseFirstImgFromHtmlFragment(inner);
    if (parsed.src) {
      if (isHeartgardenMediaPlaceholderSrc(parsed.src)) return { src: null, alt: parsed.alt };
      return parsed;
    }
  }
  const fallback = parseFirstImgFromHtmlFragment(bodyHtml);
  if (fallback.src && isHeartgardenMediaPlaceholderSrc(fallback.src)) {
    return { src: null, alt: fallback.alt };
  }
  return fallback;
}

/** Empty media card / API bootstrap: SVG grid placeholder + upload (matches standardized neutral placeholder). */
export function buildEmptyArchitecturalMediaBodyHtml(parts: {
  mediaFrameClass: string;
  imageSlotImgClass: string;
  placeholderImgClasses: string;
  mediaImageActionsClass: string;
  mediaUploadBtnClass: string;
  uploadLabel: string;
}): string {
  return `
        <div class="${parts.mediaFrameClass}" data-architectural-media-root="true">
          <img class="${parts.imageSlotImgClass} ${parts.placeholderImgClasses}" src="${HEARTGARDEN_MEDIA_PLACEHOLDER_SRC}" alt="" draggable="false" ${HG_MEDIA_PLACEHOLDER_ATTR}="true" data-hg-portrait-placeholder="true" />
          <div class="${parts.mediaImageActionsClass}" contenteditable="false">
            <button type="button" class="vigil-btn ${parts.mediaUploadBtnClass}" data-variant="ghost" data-size="sm" data-tone="glass" data-architectural-media-upload="true">${parts.uploadLabel}</button>
          </div>
        </div>
        <div data-architectural-media-notes="true"></div>
      `;
}

/** Rich HTML notes stored in `data-architectural-media-notes` after the media root in `bodyHtml`. */
export function getArchitecturalMediaNotes(bodyHtml: string): string {
  if (typeof document === "undefined") return "";
  const doc = new DOMParser().parseFromString(
    `<div id="__arch_media_notes_parse">${bodyHtml}</div>`,
    "text/html",
  );
  const wrap = doc.getElementById("__arch_media_notes_parse");
  const notesEl = wrap?.querySelector(MEDIA_NOTES_SEL);
  return notesEl?.innerHTML ?? "";
}

export function setArchitecturalMediaNotes(bodyHtml: string, notesHtml: string): string {
  if (typeof document === "undefined") return bodyHtml;
  const doc = new DOMParser().parseFromString(
    `<div id="__arch_media_notes_wrap">${bodyHtml}</div>`,
    "text/html",
  );
  const wrap = doc.getElementById("__arch_media_notes_wrap");
  if (!wrap) return bodyHtml;
  let notesEl = wrap.querySelector(MEDIA_NOTES_SEL);
  if (!notesEl) {
    notesEl = doc.createElement("div");
    notesEl.setAttribute("data-architectural-media-notes", "true");
    wrap.appendChild(notesEl);
  }
  notesEl.innerHTML = notesHtml;
  return wrap.innerHTML;
}

/** Lore v8 (and similar) portrait wells use `data-hg-lore-portrait-root` on the media root. */
export function bodyUsesLorePortraitMediaSlot(bodyHtml: string): boolean {
  return /\bdata-hg-lore-portrait-root\s*=/i.test(bodyHtml);
}

/** v9 / v10 / v11 ID card portrait slot (same `charSkPortraitImg` treatment on committed `<img>`). */
export function lorePortraitSlotUsesV9(bodyHtml: string): boolean {
  return /\bdata-hg-lore-portrait-root\s*=\s*(?:"v9"|"v10"|"v11"|'v9'|'v10'|'v11'|v9|v10|v11)\b/i.test(bodyHtml);
}

export function applyImageDataUrlToArchitecturalMediaBody(
  bodyHtml: string,
  dataUrl: string,
  alt: string,
  imageClass: string,
  options?: { uploadButtonClass?: string },
): string {
  if (typeof document === "undefined") return bodyHtml;
  const doc = new DOMParser().parseFromString(
    `<div id="__arch_media_wrap">${bodyHtml}</div>`,
    "text/html",
  );
  const wrap = doc.getElementById("__arch_media_wrap");
  const root = wrap?.querySelector(MEDIA_ROOT_SEL);
  if (!wrap || !root) return bodyHtml;

  root.querySelector("[data-architectural-media-fallback]")?.remove();

  let img = root.querySelector("img");
  if (!img) {
    img = doc.createElement("img");
    root.insertBefore(img, root.firstChild);
  }
  img.setAttribute("src", dataUrl);
  img.setAttribute("alt", alt.replace(/"/g, ""));
  if (imageClass) img.setAttribute("class", imageClass);
  img.removeAttribute("data-hg-portrait-placeholder");
  img.removeAttribute(HG_MEDIA_PLACEHOLDER_ATTR);
  const uploadBtn = root.querySelector<HTMLElement>(MEDIA_UPLOAD_BTN_SEL);
  if (uploadBtn) {
    uploadBtn.textContent = mediaUploadActionLabel(true);
    if (options?.uploadButtonClass || !uploadBtn.getAttribute("class")) {
      uploadBtn.setAttribute("class", buildMediaUploadButtonClass(options?.uploadButtonClass));
    }
    uploadBtn.setAttribute("data-variant", "ghost");
    uploadBtn.setAttribute("data-size", "sm");
    uploadBtn.setAttribute("data-tone", "glass");
  }

  return wrap.innerHTML;
}
