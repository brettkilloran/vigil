/**
 * Media cards embed a marked block in `bodyHtml` so we can replace the raster
 * after local file pick. Data URLs keep the foundation demo self-contained; a
 * real app would upload to storage and persist an HTTPS `src` instead.
 */
const MEDIA_ROOT_SEL = "[data-architectural-media-root]";
const MEDIA_NOTES_SEL = "[data-architectural-media-notes]";

/** Plain-text notes stored after the media root block in `bodyHtml`. */
export function getArchitecturalMediaNotes(bodyHtml: string): string {
  if (typeof document === "undefined") return "";
  const doc = new DOMParser().parseFromString(
    `<div id="__arch_media_notes_parse">${bodyHtml}</div>`,
    "text/html",
  );
  const wrap = doc.getElementById("__arch_media_notes_parse");
  const notesEl = wrap?.querySelector(MEDIA_NOTES_SEL);
  return notesEl?.textContent ?? "";
}

export function setArchitecturalMediaNotes(bodyHtml: string, notes: string): string {
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
  notesEl.textContent = notes;
  return wrap.innerHTML;
}

export function parseArchitecturalMediaFromBody(bodyHtml: string): {
  src: string | null;
  alt: string;
} {
  if (typeof document === "undefined") return { src: null, alt: "" };
  const doc = new DOMParser().parseFromString(
    `<div id="__arch_media_parse">${bodyHtml}</div>`,
    "text/html",
  );
  const wrap = doc.getElementById("__arch_media_parse");
  const root = wrap?.querySelector(MEDIA_ROOT_SEL);
  const img = (root ?? wrap)?.querySelector("img");
  if (!img) return { src: null, alt: "" };
  return {
    src: img.getAttribute("src"),
    alt: img.getAttribute("alt") ?? "",
  };
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
