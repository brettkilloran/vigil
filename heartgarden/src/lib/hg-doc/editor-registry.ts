import type { JSONContent } from "@tiptap/core";

export interface HgDocFormatChromeState {
  blockTag: "p" | "h1" | "h2" | "h3" | "blockquote";
  bold: boolean;
  italic: boolean;
  orderedList: boolean;
  strikeThrough: boolean;
  underline: boolean;
  unorderedList: boolean;
}

export interface HgDocEditorApi {
  canRedo: () => boolean;
  canUndo: () => boolean;
  focus: () => void;
  getFormatState: () => HgDocFormatChromeState;
  getJSON: () => JSONContent;
  insertImageFromDataUrl: (src: string, alt: string) => void;
  /** True when the doc is empty — used for canvas delete vs inline backspace. */
  isEmptyDocument?: () => boolean;
  redo: () => boolean;
  runFormat: (command: string, value?: string) => boolean;
  /** ProseMirror history undo (document-local). */
  undo: () => boolean;
}

const registry = new Map<string, HgDocEditorApi>();

export function registerHgDocEditor(
  surfaceKey: string,
  api: HgDocEditorApi | null
) {
  if (api) {
    registry.set(surfaceKey, api);
  } else {
    registry.delete(surfaceKey);
  }
}

export function getHgDocEditor(
  surfaceKey: string | null | undefined
): HgDocEditorApi | null {
  if (!surfaceKey) {
    return null;
  }
  return registry.get(surfaceKey) ?? null;
}

export function findHgDocSurfaceKeyFromSelection(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const sel = window.getSelection();
  if (sel?.rangeCount) {
    const anchor = sel.anchorNode;
    const anchorEl =
      anchor instanceof HTMLElement ? anchor : (anchor?.parentElement ?? null);
    const fromSelection = anchorEl?.closest("[data-hg-doc-surface]");
    if (fromSelection) {
      return fromSelection.getAttribute("data-hg-doc-surface") ?? null;
    }
  }
  const ae = document.activeElement;
  if (!(ae instanceof HTMLElement)) {
    return null;
  }
  const fromActive = ae.closest("[data-hg-doc-surface]");
  return fromActive?.getAttribute("data-hg-doc-surface") ?? null;
}
