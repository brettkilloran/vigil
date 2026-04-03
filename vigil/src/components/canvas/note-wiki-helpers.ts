import type { Editor } from "@tiptap/core";

import { getWikiLinkRangeFromState } from "@/src/lib/wiki-link-range";

export type WikiCtxState = {
  from: number;
  to: number;
  query: string;
  left: number;
  top: number;
} | null;

export function syncWikiFromEditor(
  ed: Editor,
  setWikiCtx: (v: WikiCtxState) => void,
) {
  const r = getWikiLinkRangeFromState(ed.state);
  if (!r) {
    setWikiCtx(null);
    return;
  }
  try {
    const c = ed.view.coordsAtPos(r.to);
    setWikiCtx({
      ...r,
      left: c.left,
      top: c.bottom + 4,
    });
  } catch {
    setWikiCtx(null);
  }
}
