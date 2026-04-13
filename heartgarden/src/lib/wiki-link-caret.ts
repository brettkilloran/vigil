/**
 * Helpers for `[[` wiki-link completion in contentEditable HTML bodies.
 */

export type WikiOpenTrigger = {
  /** Byte/char index in plain-text stream where `[[` starts. */
  startPlainOffset: number;
  /** Filter text after `[[` (may be empty). */
  query: string;
};

/** Plain text from start of `root` up to the caret (collapsed selection). */
export function plainTextToCaret(root: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";
  const anchor = sel.anchorNode;
  if (!anchor || !root.contains(anchor)) return "";
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(sel.anchorNode, sel.anchorOffset);
  return range.toString();
}

export function plainTextLengthToCaret(root: HTMLElement): number {
  return plainTextToCaret(root).length;
}

export function findOpenWikiTrigger(plainUpToCaret: string): WikiOpenTrigger | null {
  const idx = plainUpToCaret.lastIndexOf("[[");
  if (idx < 0) return null;
  const after = plainUpToCaret.slice(idx + 2);
  if (after.includes("]]")) return null;
  return { startPlainOffset: idx, query: after };
}

/**
 * Build a Range covering plain-text offsets `[start, end)` within `root` (text nodes only).
 */
export function rangeForPlainTextOffsets(
  root: HTMLElement,
  start: number,
  end: number,
): Range | null {
  if (end < start) return null;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let pos = 0;
  let startNode: Text | null = null;
  let startOff = 0;
  let endNode: Text | null = null;
  let endOff = 0;
  let foundStart = false;

  let n: Text | null = walker.nextNode() as Text | null;
  while (n) {
    const len = n.textContent?.length ?? 0;
    const nextPos = pos + len;

    if (!foundStart && nextPos > start) {
      startNode = n;
      startOff = start - pos;
      foundStart = true;
    }
    if (foundStart && nextPos >= end) {
      endNode = n;
      endOff = end - pos;
      break;
    }
    pos = nextPos;
    n = walker.nextNode() as Text | null;
  }

  if (!startNode || !endNode) return null;

  const r = document.createRange();
  try {
    r.setStart(startNode, Math.max(0, Math.min(startOff, startNode.length)));
    r.setEnd(endNode, Math.max(0, Math.min(endOff, endNode.length)));
  } catch {
    return null;
  }
  return r;
}

export function insertHtmlReplacingRange(range: Range, html: string) {
  range.deleteContents();
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const frag = tpl.content;
  const last = frag.lastChild;
  range.insertNode(frag);
  if (last) {
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      const nr = document.createRange();
      nr.setStartAfter(last);
      nr.collapse(true);
      sel.addRange(nr);
    }
  }
}
