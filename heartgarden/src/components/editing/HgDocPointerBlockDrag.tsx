"use client";

import type { Editor } from "@tiptap/core";
import type { RefObject } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { Button, type ButtonTone } from "@/src/components/ui/Button";
import { getVigilPortalRoot } from "@/src/lib/dom-portal-root";
import {
  moveTopLevelBlock,
  nthTopLevelRange,
} from "@/src/lib/hg-doc/move-top-level-block";

interface HitBase {
  /** DOM used for Y hit-test; lift uses this so we do not re-resolve via `topLevelChildDom` (can fail when `children.length !== doc.childCount`). */
  blockEl: HTMLElement;
  /** Y (viewport px) for the six-dot grip — first line of the block (Notion-style), not vertical mid of tall blocks. */
  gripAnchorY: number;
  height: number;
  index: number;
  left: number;
  top: number;
}

type Hit = HitBase & { tone: ButtonTone };

function yMarginBand(dom: HTMLElement): { yTop: number; yBottom: number } {
  const br = dom.getBoundingClientRect();
  const cs = getComputedStyle(dom);
  const mt = Number.parseFloat(cs.marginTop) || 0;
  const mb = Number.parseFloat(cs.marginBottom) || 0;
  return { yBottom: br.bottom + mb, yTop: br.top - mt };
}

function topLevelChildDom(
  view: Editor["view"],
  index: number
): HTMLElement | null {
  const { doc } = view.state;
  if (index < 0 || index >= doc.childCount) {
    return null;
  }

  const kids = view.dom.children;
  if (kids.length === doc.childCount) {
    const el = kids[index];
    if (el instanceof HTMLElement) {
      return el;
    }
  }

  const r = nthTopLevelRange(doc, index);
  if (!r) {
    return null;
  }

  for (let pos = r.from; pos < r.to; pos++) {
    const n = view.nodeDOM(pos);
    if (n instanceof HTMLElement) {
      return n;
    }
  }

  const inner = Math.min(r.from + 1, Math.max(r.from, r.to - 1));
  try {
    const at = view.domAtPos(inner);
    let node: Node | null = at.node;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }
    let el: Node | null = node;
    while (el instanceof HTMLElement) {
      if (el.parentElement === view.dom) {
        return el;
      }
      el = el.parentElement;
    }
  } catch {
    /* domAtPos can throw if pos is out of range */
  }
  return null;
}

function dropIndexFromClientY(view: Editor["view"], clientY: number): number {
  const { doc } = view.state;
  if (doc.childCount === 0) {
    return 0;
  }

  for (let i = 0; i < doc.childCount; i++) {
    const dom = topLevelChildDom(view, i);
    if (!dom) {
      continue;
    }
    const { yTop, yBottom } = yMarginBand(dom);
    if (clientY < yTop) {
      return i;
    }
    if (clientY <= yBottom) {
      const mid = (yTop + yBottom) / 2;
      return clientY < mid ? i : i + 1;
    }
  }
  return doc.childCount;
}

/** Viewport Y (client px) for a horizontal “drop here” bar before child `dropIndex`. */
function dropGapClientY(
  view: Editor["view"],
  dropIndex: number
): number | null {
  const { doc } = view.state;
  if (doc.childCount === 0) {
    return null;
  }
  if (dropIndex <= 0) {
    const dom0 = topLevelChildDom(view, 0);
    if (!dom0) {
      return null;
    }
    return yMarginBand(dom0).yTop - 2;
  }
  if (dropIndex >= doc.childCount) {
    const last = topLevelChildDom(view, doc.childCount - 1);
    if (!last) {
      return null;
    }
    return yMarginBand(last).yBottom + 2;
  }
  const up = topLevelChildDom(view, dropIndex - 1);
  const lo = topLevelChildDom(view, dropIndex);
  if (!(up && lo)) {
    return null;
  }
  const a = yMarginBand(up).yBottom;
  const b = yMarginBand(lo).yTop;
  return (a + b) / 2;
}

/** Callouts read ~2px high vs anchor math; blockquotes + task/checkbox rows need one more px than that. */
function gripAnchorVerticalNudgePx(dom: HTMLElement): number {
  if (
    dom.matches(
      'blockquote, ul[data-hg-task-list="true"], ul[data-type="taskList"], li[data-hg-task-item="true"], li[data-type="taskItem"]'
    )
  ) {
    return 3;
  }
  if (dom.matches('[data-hg-callout="true"]')) {
    return 2;
  }
  return 0;
}

function parseLineHeightPx(dom: HTMLElement, fallback = 20): number {
  const lh = getComputedStyle(dom).lineHeight;
  if (lh === "normal") {
    const fs = Number.parseFloat(getComputedStyle(dom).fontSize) || 16;
    return Math.round(fs * 1.25);
  }
  const n = Number.parseFloat(lh);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Y (viewport px) for the grip’s vertical center — first line / top inset, not mid of tall wrappers.
 * `coordsAtPos(blockStart)` often matches the first text line, but for some top-level nodes PM returns
 * a coords rect as tall as the whole block; averaging that recenters the grip vertically.
 */
function gripAnchorYForBlock(
  view: Editor["view"],
  index: number,
  dom: HTMLElement
): number {
  const br = dom.getBoundingClientRect();
  const { doc } = view.state;
  const r = nthTopLevelRange(doc, index);
  const cs = getComputedStyle(dom);
  const borderTop = Number.parseFloat(cs.borderTopWidth) || 0;
  const padTop = Number.parseFloat(cs.paddingTop) || 0;
  const lineH = parseLineHeightPx(dom);
  const innerTop = br.top + borderTop + padTop;
  const innerH = Math.max(
    0,
    br.height - borderTop - padTop - (Number.parseFloat(cs.paddingBottom) || 0)
  );

  const anchorFromBlockTop = (): number => {
    if (innerH <= 1) {
      return br.top + br.height / 2;
    }
    /* ~first line: offset scales with line-height, stays inside short blocks. */
    const raw = Math.min(lineH * 0.42, innerH * 0.38);
    const yOff = Math.max(3, Math.min(raw, innerH - 2));
    return innerTop + yOff;
  };

  let y: number;
  if (r) {
    try {
      const coords = view.coordsAtPos(r.from);
      if (
        Number.isFinite(coords.top) &&
        Number.isFinite(coords.bottom) &&
        coords.bottom > coords.top
      ) {
        const ch = coords.bottom - coords.top;
        /* Tall coords box ≈ whole block — ignore vertical mid; use top-inset anchor instead. */
        const likelyFullBlockWrapper =
          ch > Math.max(36, lineH * 2.4, innerH * 0.42);
        if (likelyFullBlockWrapper) {
          y = anchorFromBlockTop();
        } else {
          y = (coords.top + coords.bottom) / 2;
        }
      } else {
        y = anchorFromBlockTop();
      }
    } catch {
      /* invalid pos / layout not ready */
      y = anchorFromBlockTop();
    }
  } else {
    y = anchorFromBlockTop();
  }

  return y + gripAnchorVerticalNudgePx(dom);
}

function hitFromClient(
  view: Editor["view"],
  host: HTMLElement | null,
  clientX: number,
  clientY: number
): HitBase | null {
  const vr = view.dom.getBoundingClientRect();
  const hr = host?.getBoundingClientRect() ?? vr;
  /* Grip sits left of blocks (`translate(-100%)` from ~`block.left`); 80px was too tight — pointer on
     the dots fell outside this bound, `refreshHit` cleared `hit`, and the grip unmounted before `pointerdown`. */
  const leftBound = Math.min(vr.left, hr.left) - 280;
  const rightBound = Math.max(vr.right, hr.right) + 40;
  const topBound = Math.min(vr.top, hr.top);
  const bottomBound = Math.max(vr.bottom, hr.bottom);
  if (
    clientX < leftBound ||
    clientX > rightBound ||
    clientY < topBound ||
    clientY > bottomBound
  ) {
    return null;
  }

  const { doc } = view.state;
  for (let i = 0; i < doc.childCount; i++) {
    const dom = topLevelChildDom(view, i);
    if (!dom) {
      continue;
    }
    const br = dom.getBoundingClientRect();
    const { yTop, yBottom } = yMarginBand(dom);
    if (clientY >= yTop && clientY <= yBottom) {
      const gripAnchorY = gripAnchorYForBlock(view, i, dom);
      return {
        blockEl: dom,
        gripAnchorY,
        height: br.height,
        index: i,
        left: br.left,
        top: br.top,
      };
    }
  }
  return null;
}

function rgbLuminanceFromCssColor(css: string): number | null {
  const m = css.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!m) {
    return null;
  }
  const r = Number(m[1]) / 255;
  const g = Number(m[2]) / 255;
  const b = Number(m[3]) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function gripToneForHost(
  host: HTMLElement | null,
  chromeRole: "focus" | "canvas"
): ButtonTone {
  if (chromeRole === "focus") {
    return host?.closest(".focusEditorDark") ? "focus-dark" : "focus-light";
  }
  if (!host) {
    return "card-light";
  }
  const lum = rgbLuminanceFromCssColor(getComputedStyle(host).color);
  return lum != null && lum > 0.55 ? "card-dark" : "card-light";
}

function stripIdsAndEditable(root: HTMLElement) {
  root.removeAttribute("id");
  root.removeAttribute("contenteditable");
  root.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  root
    .querySelectorAll("[contenteditable]")
    .forEach((el) => el.removeAttribute("contenteditable"));
}

const DRAG_DIM_ATTR = "data-hg-doc-drag-dimmed";

/** In-doc slot while dragging — PM may recreate this node; re-apply from `reapplyDragSlotDim`. */
function dimDragSlot(el: HTMLElement) {
  el.setAttribute(DRAG_DIM_ATTR, "true");
  el.style.setProperty("opacity", "0.34", "important");
  el.style.setProperty("pointer-events", "none", "important");
}

function clearDragSlotDims(proseRoot: HTMLElement) {
  proseRoot.querySelectorAll(`[${DRAG_DIM_ATTR}]`).forEach((n) => {
    if (!(n instanceof HTMLElement)) {
      return;
    }
    n.removeAttribute(DRAG_DIM_ATTR);
    n.style.removeProperty("opacity");
    n.style.removeProperty("pointer-events");
  });
}

function reapplyDragSlotDim(view: Editor["view"], index: number) {
  const el = topLevelChildDom(view, index);
  if (el?.isConnected) {
    dimDragSlot(el);
  }
}

export function HgDocPointerBlockDrag({
  editor,
  hostRef,
  chromeRole,
  enabled,
}: {
  editor: Editor;
  hostRef: RefObject<HTMLElement | null>;
  chromeRole: "focus" | "canvas";
  enabled: boolean;
}) {
  const [hit, setHit] = useState<Hit | null>(null);
  /** 0 = idle; increments each time a drag starts so lift `useLayoutEffect` runs. */
  const [dragLiftKey, setDragLiftKey] = useState(0);
  const dragFrom = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });
  const liftStartPointer = useRef({ x: 0, y: 0 });
  const gripButtonRef = useRef<HTMLButtonElement | null>(null);
  const hitRef = useRef(hit);
  /** While set, `refreshHit` must not clear `hit` (grip stays mounted; lift ghost is active). */
  const dragSessionRef = useRef<{ index: number; blockEl: HTMLElement } | null>(
    null
  );
  /**
   * Synchronous “drag in progress” marker; RAF-driven hover refresh reads this to
   * avoid clearing the grip while a drag session is still active.
   */
  const dragActiveRef = useRef(false);

  useLayoutEffect(() => {
    hitRef.current = hit;
  }, [hit]);

  const refreshHit = useCallback(() => {
    if (
      dragActiveRef.current ||
      dragSessionRef.current != null ||
      dragFrom.current != null
    ) {
      return;
    }

    if (!(enabled && editor.view.dom.isConnected)) {
      setHit(null);
      return;
    }
    const h = hitFromClient(
      editor.view,
      hostRef.current,
      last.current.x,
      last.current.y
    );
    if (!h) {
      setHit(null);
      return;
    }
    const next = { ...h, tone: gripToneForHost(hostRef.current, chromeRole) };
    /* Avoid new object every frame (pointermove) — remounting the portaled grip drops native/React
       pointer handlers mid-gesture and matches “:active on handle but no pointerdown logs”. */
    setHit((prev) => {
      if (
        prev &&
        prev.index === next.index &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.height === next.height &&
        prev.gripAnchorY === next.gripAnchorY &&
        prev.tone === next.tone &&
        prev.blockEl === next.blockEl
      ) {
        return prev;
      }
      return next;
    });
  }, [chromeRole, editor, enabled, hostRef]);

  const endDragSession = useCallback(() => {
    dragActiveRef.current = false;
    dragSessionRef.current = null;
    dragFrom.current = null;
    setDragLiftKey(0);
  }, []);

  useLayoutEffect(() => {
    if (dragLiftKey === 0 || dragSessionRef.current == null) {
      return;
    }

    const view = editor.view;
    const session = dragSessionRef.current;
    const idx = session.index;
    const block: HTMLElement | null = session.blockEl?.isConnected
      ? session.blockEl
      : topLevelChildDom(view, idx);
    if (!block) {
      dragActiveRef.current = false;
      dragSessionRef.current = null;
      dragFrom.current = null;
      queueMicrotask(() => setDragLiftKey(0));
      return;
    }

    const rect = block.getBoundingClientRect();

    /* Clone before we restyle the source — `cloneNode` copies inline styles present at clone time. */
    const clone = block.cloneNode(true) as HTMLElement;
    stripIdsAndEditable(clone);
    clone.style.margin = "0";
    clone.style.visibility = "visible";
    clone.style.opacity = "1";

    /* Slot stays faint in the doc; ghost is opaque. PM often replaces this DOM node during drag — re-dim on transaction + move. */
    dimDragSlot(block);

    const host = hostRef.current;
    const isFocusDark = Boolean(host?.closest(".focusEditorDark"));

    /* Pointer position relative to block — ghost follows cursor like a real “pick up”, not centered on it. */
    const grabOffX = liftStartPointer.current.x - rect.left;
    const grabOffY = liftStartPointer.current.y - rect.top;

    const maxGhostW = Math.max(120, window.innerWidth - 20);
    const ghostW = Math.min(Math.ceil(rect.width), maxGhostW);

    const ghostWrap = document.createElement("div");
    ghostWrap.setAttribute("data-hg-doc-lift-ghost", "true");
    /* No filled “card” — only depth so text stays readable over the scrim without a white slab. */
    const liftShadow = isFocusDark
      ? "drop-shadow(0 10px 28px rgba(0,0,0,0.55))"
      : "drop-shadow(0 8px 22px rgba(0,0,0,0.14))";
    ghostWrap.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      "z-index:2147483640",
      "pointer-events:none",
      `width:${ghostW}px`,
      "max-width:100%",
      "box-sizing:border-box",
      "border:none",
      "border-radius:0",
      "overflow:visible",
      "background:transparent",
      "box-shadow:none",
      `filter:${liftShadow}`,
    ].join(";");

    /* Reuse prose root class chain so list/task/heading rules apply; typography from live root. */
    const mirror = document.createElement("div");
    mirror.className = view.dom.className;
    mirror.setAttribute("data-hg-doc-lift-mirror", "true");
    const pcs = getComputedStyle(view.dom);
    mirror.style.cssText = [
      "margin:0",
      "padding:4px 6px",
      "box-sizing:border-box",
      "width:100%",
      "white-space:normal",
      `color:${pcs.color}`,
      `font-family:${pcs.fontFamily}`,
      `font-size:${pcs.fontSize}`,
      `font-weight:${pcs.fontWeight}`,
      `line-height:${pcs.lineHeight}`,
      "background:transparent",
    ].join(";");

    mirror.appendChild(clone);
    ghostWrap.appendChild(mirror);

    const dropLine = document.createElement("div");
    dropLine.setAttribute("data-hg-doc-drop-line", "true");
    dropLine.style.cssText = [
      "position:fixed",
      "display:none",
      "height:2px",
      "border-radius:1px",
      "pointer-events:none",
      "z-index:2147483641",
      "background:var(--sys-color-accent-500, oklch(0.74 0.31 50))",
      "box-shadow:0 0 0 1px color-mix(in oklch, var(--sys-color-accent-500, oklch(0.74 0.31 50)) 35%, transparent)",
    ].join(";");

    const portal = getVigilPortalRoot();
    portal.appendChild(ghostWrap);
    portal.appendChild(dropLine);

    const syncDropLine = (clientY: number) => {
      const vr = view.dom.getBoundingClientRect();
      const drop = dropIndexFromClientY(view, clientY);
      const y = dropGapClientY(view, drop);
      if (y == null) {
        dropLine.style.display = "none";
        return;
      }
      dropLine.style.display = "block";
      dropLine.style.left = `${vr.left - 6}px`;
      dropLine.style.width = `${vr.width + 12}px`;
      dropLine.style.top = `${y - 1}px`;
    };

    const place = (clientX: number, clientY: number) => {
      const x = clientX - grabOffX;
      const y = clientY - grabOffY;
      ghostWrap.style.transform = `translate(${x}px, ${y}px)`;
    };
    place(liftStartPointer.current.x, liftStartPointer.current.y);
    syncDropLine(liftStartPointer.current.y);

    const onEditorTransaction = () => {
      const s = dragSessionRef.current;
      if (!s) {
        return;
      }
      reapplyDragSlotDim(view, s.index);
    };
    editor.on("transaction", onEditorTransaction);

    /* PM/TipTap often re-sync block DOM during drag (decorations, focus, etc.) and clears inline
       `style`; keep dimming applied every frame + transaction until cleanup. */
    let rafDim: number | null = null;
    const pumpDragSlotDim = () => {
      const s = dragSessionRef.current;
      if (!s) {
        rafDim = null;
        return;
      }
      reapplyDragSlotDim(view, s.index);
      rafDim = requestAnimationFrame(pumpDragSlotDim);
    };
    rafDim = requestAnimationFrame(pumpDragSlotDim);

    const onPtrMove = (ev: PointerEvent) => {
      place(ev.clientX, ev.clientY);
      syncDropLine(ev.clientY);
      const s = dragSessionRef.current;
      if (s) {
        reapplyDragSlotDim(view, s.index);
      }
    };
    window.addEventListener("pointermove", onPtrMove, { capture: true });

    return () => {
      if (rafDim != null) {
        cancelAnimationFrame(rafDim);
      }
      editor.off("transaction", onEditorTransaction);
      window.removeEventListener("pointermove", onPtrMove, true);
      ghostWrap.remove();
      dropLine.remove();
      clearDragSlotDims(view.dom);
    };
  }, [dragLiftKey, editor, hostRef]);

  useLayoutEffect(() => {
    if (dragLiftKey === 0) {
      return;
    }
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
    };
  }, [dragLiftKey]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onMove = (e: PointerEvent) => {
      last.current = { x: e.clientX, y: e.clientY };
      if (raf.current != null) {
        cancelAnimationFrame(raf.current);
      }
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        refreshHit();
      });
    };

    window.addEventListener("pointermove", onMove, {
      capture: true,
      passive: true,
    });
    editor.on("transaction", refreshHit);

    return () => {
      window.removeEventListener("pointermove", onMove, true);
      editor.off("transaction", refreshHit);
      if (raf.current != null) {
        cancelAnimationFrame(raf.current);
      }
    };
  }, [editor, enabled, refreshHit]);

  /** Native capture: survives Simple Browser / portaled grip quirks; see `setHit` dedupe above. */
  const beginGripPointerDown = useCallback(
    (ev: PointerEvent, button: HTMLButtonElement) => {
      const hi = hitRef.current;
      last.current = { x: ev.clientX, y: ev.clientY };

      const fromPointer = hitFromClient(
        editor.view,
        hostRef.current,
        ev.clientX,
        ev.clientY
      );
      const index = fromPointer?.index ?? hi?.index ?? null;
      let block: HTMLElement | null =
        fromPointer?.blockEl ?? hi?.blockEl ?? null;
      if (!block && index != null) {
        block = topLevelChildDom(editor.view, index);
      }
      if (!block && index != null) {
        const kids = editor.view.dom.children;
        if (
          index >= 0 &&
          index < kids.length &&
          kids[index] instanceof HTMLElement
        ) {
          block = kids[index] as HTMLElement;
        }
      }
      if (index == null || !block) {
        return;
      }

      ev.preventDefault();
      ev.stopPropagation();

      dragActiveRef.current = true;
      liftStartPointer.current = { x: ev.clientX, y: ev.clientY };
      dragFrom.current = index;
      dragSessionRef.current = { blockEl: block, index };
      setDragLiftKey((k) => k + 1);

      try {
        button.setPointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    },
    [editor, hostRef]
  );

  /* Document capture: portaled + embedded browsers sometimes skip the button’s own listener chain;
     still require `gripButtonRef` so we only handle *this* editor’s grip. */
  useEffect(() => {
    if (!(enabled && editor.isEditable)) {
      return;
    }
    const onDocPointerDownCapture = (ev: PointerEvent) => {
      const t = ev.target;
      if (!(t instanceof Element)) {
        return;
      }
      const btn = t.closest("[data-hg-doc-block-drag-grip]");
      if (!(btn && btn instanceof HTMLButtonElement)) {
        return;
      }
      if (btn !== gripButtonRef.current) {
        return;
      }
      beginGripPointerDown(ev, btn);
    };
    document.addEventListener("pointerdown", onDocPointerDownCapture, true);
    return () =>
      document.removeEventListener(
        "pointerdown",
        onDocPointerDownCapture,
        true
      );
  }, [beginGripPointerDown, editor.isEditable, enabled]);

  const finishDrag = useCallback(
    (e: React.PointerEvent) => {
      if (dragFrom.current == null) {
        return;
      }
      e.preventDefault();
      const from = dragFrom.current;
      const drop = dropIndexFromClientY(editor.view, e.clientY);

      try {
        (e.currentTarget as HTMLButtonElement).releasePointerCapture(
          e.pointerId
        );
      } catch {
        /* ignore */
      }

      endDragSession();

      if (!editor.isEditable) {
        return;
      }
      if (drop === from || drop === from + 1) {
        return;
      }
      moveTopLevelBlock(editor, from, drop);
    },
    [editor, endDragSession]
  );

  if (!enabled || typeof document === "undefined") {
    return null;
  }

  const draggingUi = dragLiftKey > 0;

  const grip =
    hit && editor.isEditable ? (
      <Button
        aria-label="Drag to move block"
        data-hg-doc-block-drag-grip="true"
        onLostPointerCapture={() => {
          endDragSession();
        }}
        onPointerCancel={finishDrag}
        onPointerUp={finishDrag}
        ref={gripButtonRef}
        size="icon"
        style={{
          cursor: draggingUi ? "grabbing" : "grab",
          left: Math.max(8, hit.left - 8),
          pointerEvents: "auto",
          position: "fixed",
          top: hit.gripAnchorY,
          transform: "translate(-100%, -50%)",
          zIndex: 2_147_483_000,
        }}
        tone={hit.tone}
        type="button"
        variant="ghost"
      >
        <span aria-hidden>
          <svg
            height="14"
            viewBox="0 0 10 14"
            width="10"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="2.5" cy="2.5" fill="currentColor" r="1.25" />
            <circle cx="7.5" cy="2.5" fill="currentColor" r="1.25" />
            <circle cx="2.5" cy="7" fill="currentColor" r="1.25" />
            <circle cx="7.5" cy="7" fill="currentColor" r="1.25" />
            <circle cx="2.5" cy="11.5" fill="currentColor" r="1.25" />
            <circle cx="7.5" cy="11.5" fill="currentColor" r="1.25" />
          </svg>
        </span>
      </Button>
    ) : null;

  const portalEl = getVigilPortalRoot();
  return grip ? createPortal(grip, portalEl) : null;
}
