import type { JSONContent } from "@tiptap/core";

export type HgDocFormatChromeState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  unorderedList: boolean;
  orderedList: boolean;
  blockTag: "p" | "h1" | "h2" | "h3" | "blockquote";
};

export type HgDocEditorApi = {
  runFormat: (command: string, value?: string) => boolean;
  getFormatState: () => HgDocFormatChromeState;
  getJSON: () => JSONContent;
  focus: () => void;
  insertImageFromDataUrl: (src: string, alt: string) => void;
  /** ProseMirror history undo (document-local). */
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  /** True when the doc is empty — used for canvas delete vs inline backspace. */
  isEmptyDocument?: () => boolean;
};

const registry = new Map<string, HgDocEditorApi>();

export function registerHgDocEditor(surfaceKey: string, api: HgDocEditorApi | null) {
  if (api) registry.set(surfaceKey, api);
  else registry.delete(surfaceKey);
}

export function getHgDocEditor(surfaceKey: string | null | undefined): HgDocEditorApi | null {
  if (!surfaceKey) return null;
  return registry.get(surfaceKey) ?? null;
}

export function findHgDocSurfaceKeyFromSelection(): string | null {
  if (typeof document === "undefined") return null;
  const sel = window.getSelection();
  if (sel?.rangeCount) {
    const anchor = sel.anchorNode;
    const anchorEl =
      anchor instanceof HTMLElement ? anchor : anchor?.parentElement ?? null;
    const fromSelection = anchorEl?.closest("[data-hg-doc-surface]");
    if (fromSelection) {
      return fromSelection.getAttribute("data-hg-doc-surface") ?? null;
    }
  }
  const ae = document.activeElement;
  if (!(ae instanceof HTMLElement)) return null;
  const fromActive = ae.closest("[data-hg-doc-surface]");
  return fromActive?.getAttribute("data-hg-doc-surface") ?? null;
}
