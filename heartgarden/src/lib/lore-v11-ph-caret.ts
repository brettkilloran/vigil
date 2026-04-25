/**
 * v11 `data-hg-lore-ph`: position placeholder `::before` (and strip marker bands) from the
 * logical start of the field so markers stay stable across mount, focus, and idle repaint.
 */

import { LORE_V11_PH_LOCATION_PLACEHOLDER } from "@/src/lib/lore-location-focus-document-html";
import { LORE_V11_PH_DISPLAY_NAME } from "@/src/lib/lore-node-seed-html";
import { LORE_V9_REDACTED_SENTINEL } from "@/src/lib/lore-v9-placeholder";
import { syncLoreV11MarkerTilts } from "@/src/lib/lore-v11-marker-tilt";

const PH_X = "--hg-lore-ph-x";
const PH_Y = "--hg-lore-ph-y";
const PH_LH = "--hg-lore-ph-lh";

/** v11 placeholder `::before` nudge vs measured caret line (design tuning). */
const PLACEHOLDER_Y_OFFSET_DISPLAY_NAME_PX = 2;
const PLACEHOLDER_Y_OFFSET_OTHER_FIELDS_PX = -1;

function px(n: number): string {
  return `${Math.round(n * 1000) / 1000}px`;
}

export function clearLoreV11PhCaretVars(el: HTMLElement): void {
  el.style.removeProperty(PH_X);
  el.style.removeProperty(PH_Y);
  el.style.removeProperty(PH_LH);
}

function charSkShellsV11Under(root: HTMLElement): HTMLElement[] {
  if (root.matches?.(`[class*="charSkShellV11"]`)) {
    return [root];
  }
  return [...root.querySelectorAll<HTMLElement>(`[class*="charSkShellV11"]`)];
}

/** Location ORDO v7 slab — same `data-hg-lore-ph` caret sync as character v11. */
function locOrdoV7RootsUnder(root: HTMLElement): HTMLElement[] {
  if (root.matches?.(`[class*="locOrdoV7Root"]`)) {
    return [root];
  }
  return [...root.querySelectorAll<HTMLElement>(`[class*="locOrdoV7Root"]`)];
}

/** Collapsed range at the start of the field’s editable surface (when no usable selection). */
function rangeAtFieldStart(field: HTMLElement): Range | null {
  const range = document.createRange();
  try {
    if (field.matches?.('[class*="charSkNotesBody"]')) {
      const p = field.querySelector("p");
      if (p) {
        range.selectNodeContents(p);
        range.collapse(true);
        return range;
      }
      range.selectNodeContents(field);
      range.collapse(true);
      return range;
    }

    if (field.childNodes.length === 0) {
      range.selectNodeContents(field);
      range.collapse(true);
      return range;
    }

    const first = field.firstChild!;
    if (first.nodeType === Node.TEXT_NODE) {
      range.setStart(first, 0);
      range.collapse(true);
      return range;
    }
    if (first.nodeName === "BR") {
      range.setStartBefore(first);
      range.collapse(true);
      return range;
    }
    range.setStart(first, 0);
    range.collapse(true);
    return range;
  } catch {
    return null;
  }
}

/** When the collapsed caret has no measurable box (common on `<br>`-only editables), still set `--hg-lore-ph-*`. */
function fallbackCaretLineBox(field: HTMLElement): {
  x: number;
  y: number;
  h: number;
} {
  const cs = getComputedStyle(field);
  const fontSize = Number.parseFloat(cs.fontSize) || 13;
  let lh = Number.parseFloat(cs.lineHeight);
  if (!Number.isFinite(lh) || lh <= 0 || cs.lineHeight === "normal") {
    lh = fontSize * 1.2;
  }
  return { h: lh, x: 0, y: 0 };
}

/**
 * Caret line box for v11 placeholder strips + caption. Always uses the logical **start** of the field
 * (not the live selection) so marker bands do not jump between idle mount and focus/interaction.
 */
function caretBoxForField(field: HTMLElement): {
  x: number;
  y: number;
  h: number;
} {
  const fb = fallbackCaretLineBox(field);
  const range = rangeAtFieldStart(field);
  if (!range) {
    return fb;
  }

  const fr = field.getBoundingClientRect();
  if (fr.width <= 0 || fr.height <= 0) {
    return { h: fb.h, x: 0, y: 0 };
  }

  let rr = range.getBoundingClientRect();
  if (rr.width === 0 && rr.height === 0) {
    const cr = range.getClientRects();
    if (cr.length > 0) {
      rr = cr[0]!;
    }
  }
  if (rr.width === 0 && rr.height === 0) {
    return { h: fb.h, x: 0, y: 0 };
  }

  const x = rr.left - fr.left;
  const y = rr.top - fr.top;
  const h = Math.max(rr.height, 1);
  return { h, x, y };
}

/**
 * Sets `--hg-lore-ph-{x,y,lh}` on v11 fields with `data-hg-lore-ph` while placeholder is active.
 * `host` is any ancestor of the card (e.g. rich editor root).
 */
export function syncLoreV11PhCaretOffsetsInHost(
  host: HTMLElement | null
): void {
  if (!host || typeof document === "undefined") {
    return;
  }
  const shells = [...charSkShellsV11Under(host), ...locOrdoV7RootsUnder(host)];
  if (!shells.length) {
    return;
  }

  for (const shell of shells) {
    for (const el of shell.querySelectorAll<HTMLElement>(
      "[data-hg-lore-field]"
    )) {
      if (
        el.getAttribute("data-hg-lore-placeholder") !== "true" ||
        !el.hasAttribute("data-hg-lore-ph")
      ) {
        clearLoreV11PhCaretVars(el);
        continue;
      }
      const box = caretBoxForField(el);
      /* Match by `data-hg-lore-ph`, not DOM class: CSS-module hashes may omit the readable `charSkDisplayName` substring. */
      const ph = el.getAttribute("data-hg-lore-ph");
      const isDisplayNameField =
        ph === LORE_V11_PH_DISPLAY_NAME ||
        ph === LORE_V11_PH_LOCATION_PLACEHOLDER ||
        (ph === LORE_V9_REDACTED_SENTINEL &&
          el.matches?.('[class*="charSkDisplayName"]') === true);
      /* Faction archive letterhead org name: single-line strip marker (not dual-line display name block). */
      const isFactionLetterheadPrimaryTitle =
        el.getAttribute("data-hg-lore-faction-field") === "orgNamePrimary";
      const yOff =
        isDisplayNameField && !isFactionLetterheadPrimaryTitle
          ? PLACEHOLDER_Y_OFFSET_DISPLAY_NAME_PX
          : PLACEHOLDER_Y_OFFSET_OTHER_FIELDS_PX;
      el.style.setProperty(PH_X, px(box.x));
      el.style.setProperty(PH_Y, px(box.y + yOff));
      el.style.setProperty(PH_LH, px(box.h));
    }
  }
}

/**
 * Keeps v11 placeholder offsets in sync with selection, layout, and resize.
 */
export function installLoreV11PlaceholderCaretSync(
  host: HTMLElement
): () => void {
  syncLoreV11MarkerTilts(host);

  let raf = 0;
  const run = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      syncLoreV11MarkerTilts(host);
      syncLoreV11PhCaretOffsetsInHost(host);
    });
  };

  syncLoreV11PhCaretOffsetsInHost(host);
  queueMicrotask(run);

  document.addEventListener("selectionchange", run);
  window.addEventListener("resize", run);
  const ro =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(run);
  ro?.observe(host);

  const onFocusIn = (e: FocusEvent) => {
    const t = e.target;
    if (t instanceof Node && host.contains(t)) {
      run();
    }
  };
  host.addEventListener("focusin", onFocusIn, true);

  return () => {
    cancelAnimationFrame(raf);
    document.removeEventListener("selectionchange", run);
    window.removeEventListener("resize", run);
    ro?.disconnect();
    host.removeEventListener("focusin", onFocusIn, true);
  };
}
