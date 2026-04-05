/**
 * Prefer this over `document.body` for `createPortal` so overlays detach from a stable subtree
 * (avoids intermittent `removeChild` / null parent races with concurrent React + Next.js).
 */
export function getVigilPortalRoot(): HTMLElement {
  if (typeof document === "undefined") {
    throw new Error("getVigilPortalRoot() is browser-only");
  }
  return document.getElementById("hg-portal-root") ?? document.body;
}
