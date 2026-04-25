/**
 * Dedicated mount node for `createPortal`.
 *
 * Do **not** fall back to `document.body`: portal children would sit as siblings of the Next.js
 * React root and concurrent updates have produced intermittent
 * `TypeError: Cannot read properties of null (reading 'removeChild')` (React 19).
 */
export function getVigilPortalRoot(): HTMLElement {
  if (typeof document === "undefined") {
    throw new Error("getVigilPortalRoot() is browser-only");
  }
  const fromLayout = document.getElementById("hg-portal-root");
  if (fromLayout) {
    return fromLayout;
  }

  const el = document.createElement("div");
  el.id = "hg-portal-root";
  el.setAttribute("data-hg-portal-root", "ensured");
  document.body.appendChild(el);
  return el;
}
