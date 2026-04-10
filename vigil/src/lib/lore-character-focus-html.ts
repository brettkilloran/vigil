/**
 * Split / merge v11 character credential HTML for focus mode:
 * structured ID plate (header, portrait, identity, notes shell) vs long-form notes body (`charSkNotesBody`).
 */

const DEFAULT_NOTES_PLACEHOLDER = "<p><br></p>";

function parseInWrapper(html: string): Document | null {
  if (typeof document === "undefined" || typeof DOMParser === "undefined") return null;
  try {
    return new DOMParser().parseFromString(`<div id="__hg_cf_root">${html}</div>`, "text/html");
  } catch {
    return null;
  }
}

/** Extract inner notes HTML and leave structured HTML with an empty notes body (seed-shaped). */
export function splitCharacterV11BodyForFocus(html: string): { structured: string; paper: string } {
  const doc = parseInWrapper(html);
  const root = doc?.getElementById("__hg_cf_root");
  if (!root) {
    return { structured: html, paper: DEFAULT_NOTES_PLACEHOLDER };
  }
  const notesBody = root.querySelector('[class*="charSkNotesBody"]') as HTMLElement | null;
  if (!notesBody) {
    return { structured: html, paper: DEFAULT_NOTES_PLACEHOLDER };
  }
  const paper = (notesBody.innerHTML || "").trim() ? notesBody.innerHTML : DEFAULT_NOTES_PLACEHOLDER;
  notesBody.innerHTML = DEFAULT_NOTES_PLACEHOLDER;
  return { structured: root.innerHTML, paper };
}

/** Inject paper HTML into the `charSkNotesBody` region of structured HTML. */
export function mergeCharacterV11FocusDrafts(structured: string, paper: string): string {
  const doc = parseInWrapper(structured);
  const root = doc?.getElementById("__hg_cf_root");
  if (!root) return structured;
  const notesBody = root.querySelector('[class*="charSkNotesBody"]') as HTMLElement | null;
  if (!notesBody) return structured;
  notesBody.innerHTML = paper.trim() ? paper : DEFAULT_NOTES_PLACEHOLDER;
  return root.innerHTML;
}
