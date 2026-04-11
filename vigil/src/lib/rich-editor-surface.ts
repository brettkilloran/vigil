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

/**
 * Rich surfaces often wrap nested `contenteditable` regions (character/location notes on canvas,
 * focus notes vs metadata fields). `document.execCommand` and caret recovery must target the
 * innermost contenteditable that actually contains the selection — not only the outer
 * `[data-node-body-editor]` / `[data-focus-body-editor]` host.
 */
function innermostContentEditableWithin(surfaceRoot: HTMLElement, start: Node | null): HTMLElement {
  let n: Node | null = start;
  if (n?.nodeType === Node.TEXT_NODE) n = n.parentElement;
  let el = n instanceof HTMLElement ? n : null;
  while (el && surfaceRoot.contains(el)) {
    if (el.isContentEditable) return el;
    el = el.parentElement;
  }
  return surfaceRoot;
}

/**
 * Resolves the element that should receive `execCommand`, synthetic `input`, and `placeCaretAtEnd`
 * fallbacks for the current selection. Prefer `document.activeElement`; fall back to selection anchor.
 */
/** Checklist row text cell — block-level `execCommand` must target the outer prose host, not this leaf. */
export const ARCH_TASK_TEXT_SELECTOR = '[data-arch-task-text="true"]';

/**
 * When the innermost editable is a checklist text cell, climb to the nearest ancestor that is
 * `contenteditable` and not itself a task-text cell (the document / notes surface).
 */
export function unwrapTaskTextBlockHost(surface: HTMLElement | null): HTMLElement | null {
  if (!surface) return null;
  if (!surface.matches(ARCH_TASK_TEXT_SELECTOR)) return surface;
  let p: HTMLElement | null = surface.parentElement;
  while (p) {
    if (p.isContentEditable && !p.matches(ARCH_TASK_TEXT_SELECTOR)) return p;
    p = p.parentElement;
  }
  return null;
}

/** Move caret to immediately after the checklist row so list / HR / checklist inserts stay at block level. */
export function moveCaretAfterTaskItemForBlockInsert(
  proseShell: HTMLElement,
  taskTextEl: HTMLElement,
): void {
  const taskItem = taskTextEl.parentElement;
  const sel = typeof document !== "undefined" ? document.getSelection() : null;
  if (!taskItem || !proseShell.contains(taskItem) || !sel) return;
  const r = document.createRange();
  r.setStartAfter(taskItem);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

export function resolveProseCommandTarget(shell: HTMLElement | null, activeEl: Element | null): HTMLElement | null {
  if (!shell) return null;

  const fromNode = (node: Node | null): HTMLElement | null => {
    const surface = resolveActiveRichEditorSurface(
      node && node.nodeType === Node.TEXT_NODE ? (node.parentElement as Element | null) : (node as Element | null),
    );
    if (!surface.root || !shell.contains(surface.root)) return null;
    return innermostContentEditableWithin(surface.root, node);
  };

  if (activeEl instanceof HTMLElement && shell.contains(activeEl)) {
    const hit = fromNode(activeEl);
    if (hit) return hit;
  }

  if (typeof document !== "undefined") {
    const sel = document.getSelection();
    if (sel?.rangeCount) {
      const hit = fromNode(sel.getRangeAt(0).commonAncestorContainer);
      if (hit) return hit;
    }
  }

  return null;
}
