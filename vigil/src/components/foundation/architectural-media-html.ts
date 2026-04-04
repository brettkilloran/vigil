/**
 * Media cards embed a marked block in `bodyHtml` so we can replace the raster
 * after local file pick. Data URLs keep the foundation demo self-contained; a
 * real app would upload to storage and persist an HTTPS `src` instead.
 */
const MEDIA_ROOT_SEL = "[data-architectural-media-root]";
const MEDIA_NOTES_SEL = "[data-architectural-media-notes]";

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
    if (parsed.src) return parsed;
  }
  return parseFirstImgFromHtmlFragment(bodyHtml);
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

export function applyImageDataUrlToArchitecturalMediaBody(
  bodyHtml: string,
  dataUrl: string,
  alt: string,
  imageClass: string,
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

  return wrap.innerHTML;
}
