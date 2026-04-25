import { RICH_EDITOR_SURFACE_SELECTOR } from "@/src/lib/rich-editor-surface";

export interface WordUnderPointer {
  rect: DOMRect;
  word: string;
}

export function readWordUnderPointer(
  clientX: number,
  clientY: number
): WordUnderPointer | null {
  const el = document.elementFromPoint(clientX, clientY);
  if (!(el instanceof HTMLElement)) {
    return null;
  }
  const surface = el.closest<HTMLElement>(RICH_EDITOR_SURFACE_SELECTOR);
  if (!surface) {
    return null;
  }

  let node: Node | null = null;
  let offset = 0;
  const caretPos = (
    document as Document & {
      caretPositionFromPoint?: (
        x: number,
        y: number
      ) => { offsetNode: Node; offset: number } | null;
    }
  ).caretPositionFromPoint?.(clientX, clientY);
  if (caretPos) {
    node = caretPos.offsetNode;
    offset = caretPos.offset;
  } else {
    const range = (
      document as Document & {
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
      }
    ).caretRangeFromPoint?.(clientX, clientY);
    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }
  if (!(node instanceof Text)) {
    return null;
  }
  const text = node.textContent ?? "";
  if (!text) {
    return null;
  }

  const isWord = (ch: string) => /[A-Za-z0-9_-]/.test(ch);
  let start = Math.max(0, Math.min(offset, text.length));
  let end = start;
  while (start > 0 && isWord(text[start - 1]!)) {
    start -= 1;
  }
  while (end < text.length && isWord(text[end]!)) {
    end += 1;
  }
  const word = text.slice(start, end).trim();
  if (!word || word.length < 2) {
    return null;
  }

  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const rect = range.getBoundingClientRect();
  return { rect, word };
}
