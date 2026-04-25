"use client";

import type { Editor } from "@tiptap/core";
import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import styles from "@/src/components/editing/HgAiPendingEditorGutter.module.css";
import { ArchitecturalTooltip } from "@/src/components/foundation/architectural-tooltip";
import { Button } from "@/src/components/ui/button";
import { collectHgAiPendingRangeMetrics } from "@/src/lib/hg-doc/collect-hg-ai-pending-ranges";
import { removeHgAiPendingRange } from "@/src/lib/hg-doc/remove-hg-ai-pending-range";

const HOVER_CLASS = "hgAiPending--gutter-hover";

/** Top offset vs pending span top edge (negative = nudge up vs first implementation). */
const BIND_TOP_INSET_PX = -4;

/** Min vertical gap between stacked Bind controls when several pending runs sit on one line. */
const MIN_BIND_STACK_GAP_PX = 26;
const MOSTLY_GENERATED_PENDING_COVERAGE_THRESHOLD = 0.68;

function findPendingSpanForRange(
  editor: Editor,
  from: number
): HTMLElement | null {
  const maxPos = Math.max(0, editor.state.doc.content.size - 1);
  const candidates = [from, from + 1, Math.max(0, from - 1)].filter(
    (p) => p <= maxPos
  );
  for (const p of candidates) {
    try {
      const domAt = editor.view.domAtPos(p);
      let n: Node | null = domAt.node;
      if (n.nodeType === Node.TEXT_NODE) {
        n = n.parentElement;
      }
      while (n && n !== editor.view.dom) {
        if (
          n instanceof HTMLElement &&
          n.matches("[data-hg-ai-pending], span.hgAiPending")
        ) {
          return n;
        }
        n = n.parentElement;
      }
    } catch {
      /* domAtPos can throw at invalid positions */
    }
  }
  return null;
}

function clearHoverClasses(root: HTMLElement) {
  for (const el of root.querySelectorAll(`.${HOVER_CLASS}`)) {
    el.classList.remove(HOVER_CLASS);
  }
}

export interface HgAiPendingEditorGutterProps {
  editor: Editor;
  /** Row that contains the editor column + this rail (for `top` positioning). */
  wrapRef: RefObject<HTMLElement | null>;
}

export function HgAiPendingEditorGutter({
  editor,
  wrapRef,
}: HgAiPendingEditorGutterProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [_docVersion, setDocVersion] = useState(0);
  const [_layoutTick, setLayoutTick] = useState(0);
  const [tops, setTops] = useState<number[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);

  const pending = useMemo(
    () => collectHgAiPendingRangeMetrics(editor),
    // docVersion bumps on TipTap update/selectionUpdate; editor ref is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- docVersion
    [editor]
  );
  const ranges = pending.ranges;
  const hideRangeBinds =
    pending.pendingCoverage >= MOSTLY_GENERATED_PENDING_COVERAGE_THRESHOLD;

  useEffect(() => {
    const bump = () => setDocVersion((v) => v + 1);
    editor.on("update", bump);
    editor.on("selectionUpdate", bump);
    return () => {
      editor.off("update", bump);
      editor.off("selectionUpdate", bump);
    };
  }, [editor]);

  /* Initial content does not always emit `update`; re-collect ranges after first layout frame. */
  useEffect(() => {
    const id = requestAnimationFrame(() => setDocVersion((v) => v + 1));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) {
      return;
    }
    const ro = new ResizeObserver(() => setLayoutTick((t) => t + 1));
    ro.observe(wrap);
    const onWin = () => setLayoutTick((t) => t + 1);
    window.addEventListener("scroll", onWin, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onWin, true);
    };
  }, [wrapRef]);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const rail = railRef.current;
    if (!(wrap && rail) || ranges.length === 0) {
      setTops([]);
      return;
    }
    const wr = wrap.getBoundingClientRect();
    const raw: number[] = [];
    for (const { from } of ranges) {
      const span = findPendingSpanForRange(editor, from);
      if (span) {
        const sr = span.getBoundingClientRect();
        raw.push(sr.top - wr.top + wrap.scrollTop + BIND_TOP_INSET_PX);
      } else {
        const start = editor.view.coordsAtPos(from);
        raw.push(start.top - wr.top + wrap.scrollTop + BIND_TOP_INSET_PX);
      }
    }
    const indexed = raw.map((top, i) => ({ i, top }));
    indexed.sort((a, b) => (a.top === b.top ? a.i - b.i : a.top - b.top));
    for (let j = 1; j < indexed.length; j++) {
      const prev = indexed[j - 1]!;
      const cur = indexed[j]!;
      cur.top = Math.max(cur.top, prev.top + MIN_BIND_STACK_GAP_PX);
    }
    const next: number[] = new Array(ranges.length);
    for (const { i, top } of indexed) {
      next[i] = top;
    }
    setTops(next);
  }, [editor, ranges, wrapRef]);

  const safeHovered =
    hovered !== null && hovered < ranges.length && hovered >= 0
      ? hovered
      : null;

  useLayoutEffect(() => {
    const root = editor.view.dom as HTMLElement;
    clearHoverClasses(root);
    if (safeHovered == null) {
      return;
    }
    const span = findPendingSpanForRange(
      editor,
      ranges[safeHovered]?.from ?? 0
    );
    if (span) {
      span.classList.add(HOVER_CLASS);
    }
    return () => {
      clearHoverClasses(root);
    };
  }, [editor, safeHovered, ranges]);

  if (ranges.length === 0 || hideRangeBinds) {
    return null;
  }

  return (
    <div className={styles.rail} ref={railRef}>
      {ranges.map((r, i) => (
        <div
          className={styles.acceptAnchor}
          // biome-ignore lint/suspicious/noArrayIndexKey: pending-AI ranges have no stable id and may share `${from}-${to}` (overlapping marks); index disambiguates the in-list duplicates
          key={`${r.from}-${r.to}-${i}`}
          style={{ top: tops[i] ?? 0 }}
        >
          <ArchitecturalTooltip
            content="Bind this passage into your note (clears pending highlight)"
            delayMs={280}
            side="left"
          >
            <Button
              aria-label="Bind AI text in this section"
              className={styles.bindBtn}
              data-hg-ai-bind="true"
              onBlur={() => setHovered(null)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                removeHgAiPendingRange(editor, r.from, r.to);
                setHovered(null);
              }}
              onFocus={() => setHovered(i)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              size="xs"
              type="button"
              variant="subtle"
            >
              Bind
            </Button>
          </ArchitecturalTooltip>
        </div>
      ))}
    </div>
  );
}
