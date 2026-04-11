export const RICH_EDITOR_SURFACE_SELECTOR =
  "[data-node-body-editor], [data-focus-body-editor], [data-architectural-media-gallery-notes]";

export const RICH_EDITOR_NESTED_NOTES_SELECTOR =
  '[data-hg-character-focus-notes="true"], [data-hg-lore-location-focus-notes="true"], [class*="charSkNotesBody"], [class*="char3dNotesBody"]';

export type RichEditorSurfaceKind =
  | "node-body"
  | "focus-body"
  | "media-gallery-notes"
  | "unknown";

export function resolveActiveRichEditorSurface(startEl: Element | null): {
  root: HTMLElement | null;
  kind: RichEditorSurfaceKind;
} {
  if (!startEl || !(startEl instanceof HTMLElement)) {
    return { root: null, kind: "unknown" };
  }
  const root = startEl.closest<HTMLElement>(RICH_EDITOR_SURFACE_SELECTOR);
  if (!root) return { root: null, kind: "unknown" };
  if (root.matches("[data-node-body-editor]")) return { root, kind: "node-body" };
  if (root.matches("[data-focus-body-editor]")) return { root, kind: "focus-body" };
  if (root.matches("[data-architectural-media-gallery-notes]")) {
    return { root, kind: "media-gallery-notes" };
  }
  return { root, kind: "unknown" };
}

export function caretIsWithinRichDocInsertRegion(
  focusEl: Element | null,
  surfaceRoot: HTMLElement,
  kind: RichEditorSurfaceKind,
): boolean {
  if (kind === "media-gallery-notes") return true;
  if (!focusEl || !(focusEl instanceof HTMLElement)) return false;
  if (!surfaceRoot.contains(focusEl)) return false;
  if (surfaceRoot.querySelector('[data-hg-character-focus-doc="v1"]')) {
    return !!focusEl.closest('[data-hg-character-focus-notes="true"]');
  }
  if (surfaceRoot.querySelector('[data-hg-location-focus-doc="v1"]')) {
    return !!focusEl.closest('[data-hg-lore-location-focus-notes="true"]');
  }
  return true;
}

export function findFirstEditableNestedNotesRoot(root: ParentNode): HTMLElement | null {
  for (const node of root.querySelectorAll<HTMLElement>(RICH_EDITOR_NESTED_NOTES_SELECTOR)) {
    if (node.isContentEditable) return node;
  }
  return null;
}
