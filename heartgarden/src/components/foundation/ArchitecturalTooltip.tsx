"use client";

import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";

import { getVigilPortalRoot } from "@/src/lib/dom-portal-root";

const VIEWPORT_MARGIN = 10;
const OFFSET = 8;

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (ref == null) return;
  if (typeof ref === "function") ref(value);
  else (ref as { current: T | null }).current = value;
}

type Side = "top" | "bottom" | "left" | "right";

/** Stable array identity for `avoidSides` on bottom-anchored chrome (dock, metrics strip, etc.). */
export const ARCH_TOOLTIP_AVOID_BOTTOM: readonly Side[] = ["bottom"];

/** Stable array identity for `avoidSides` on top strips (nav, top-right tools). */
export const ARCH_TOOLTIP_AVOID_TOP: readonly Side[] = ["top"];

function preferredSideOrder(preferred: Side): Side[] {
  switch (preferred) {
    case "top":
      return ["top", "bottom", "right", "left"];
    case "bottom":
      return ["bottom", "top", "right", "left"];
    case "left":
      return ["left", "right", "top", "bottom"];
    case "right":
      return ["right", "left", "top", "bottom"];
    default:
      return ["top", "bottom", "right", "left"];
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** React 19: ref is a normal prop — do not read `element.ref` (deprecated). */
function innerRefOf(el: ReactElement) {
  const p = el.props as { ref?: Ref<HTMLElement> | undefined };
  return p.ref;
}

function pointerOutLeavesTarget(
  currentTarget: EventTarget | null,
  relatedTarget: EventTarget | null,
) {
  if (!(currentTarget instanceof Element)) return true;
  if (relatedTarget == null) return true;
  if (!(relatedTarget instanceof Node)) return true;
  return !currentTarget.contains(relatedTarget);
}

export function ArchitecturalTooltip({
  content,
  children,
  side = "top",
  delayMs = 280,
  disabled = false,
  /** When true, `aria-describedby` points at the tooltip while open (e.g. long help vs short label). */
  associateDescription = false,
  /**
   * Sides to skip when resolving viewport overflow. Use `["bottom"]` for bottom-dock / bottom-right
   * chrome so tips stay above controls instead of flipping onto the canvas; `["top"]` for top strips.
   */
  avoidSides,
}: {
  content: ReactNode;
  children: ReactElement;
  side?: Side;
  delayMs?: number;
  disabled?: boolean;
  associateDescription?: boolean;
  avoidSides?: readonly Side[];
}) {
  const tipId = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [paintOpen, setPaintOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current != null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const scheduleShow = useCallback(
    (immediate: boolean) => {
      if (disabled || content == null || content === "") return;
      clearShowTimer();
      const run = () => setOpen(true);
      if (immediate) run();
      else showTimerRef.current = setTimeout(run, delayMs);
    },
    [clearShowTimer, content, delayMs, disabled],
  );

  const scheduleHide = useCallback(() => {
    clearShowTimer();
    setOpen(false);
    setPaintOpen(false);
  }, [clearShowTimer]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    const tip = surfaceRef.current;
    if (!el || !tip) return;

    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = 0;
    let left = 0;
    let resolvedSide: Side = side;

    const place = (s: Side) => {
      switch (s) {
        case "top":
          top = r.top - th - OFFSET;
          left = r.left + r.width / 2 - tw / 2;
          break;
        case "bottom":
          top = r.bottom + OFFSET;
          left = r.left + r.width / 2 - tw / 2;
          break;
        case "left":
          top = r.top + r.height / 2 - th / 2;
          left = r.left - tw - OFFSET;
          break;
        case "right":
          top = r.top + r.height / 2 - th / 2;
          left = r.right + OFFSET;
          break;
        default:
          break;
      }
    };

    place(side);

    const overflow = () =>
      top < VIEWPORT_MARGIN ||
      left < VIEWPORT_MARGIN ||
      top + th > vh - VIEWPORT_MARGIN ||
      left + tw > vw - VIEWPORT_MARGIN;

    if (overflow()) {
      const avoid = new Set(avoidSides ?? []);
      let order = preferredSideOrder(side).filter((s) => !avoid.has(s));
      if (order.length === 0) order = [side];

      for (const s of order) {
        place(s);
        if (!overflow()) {
          resolvedSide = s;
          break;
        }
      }
    }

    left = clamp(left, VIEWPORT_MARGIN, vw - tw - VIEWPORT_MARGIN);
    top = clamp(top, VIEWPORT_MARGIN, vh - th - VIEWPORT_MARGIN);

    tip.dataset.side = resolvedSide;
    setCoords({ top, left });
  }, [side, avoidSides]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, content, updatePosition]);

  useLayoutEffect(() => {
    if (!open || !paintOpen) return;
    updatePosition();
  }, [open, paintOpen, updatePosition]);

  useLayoutEffect(() => {
    if (!open) {
      const id = requestAnimationFrame(() => setPaintOpen(false));
      return () => cancelAnimationFrame(id);
    }
    const id = requestAnimationFrame(() => setPaintOpen(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") scheduleHide();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, scheduleHide]);

  useEffect(
    () => () => {
      clearShowTimer();
    },
    [clearShowTimer],
  );

  const childProps = children.props as {
    onPointerOver?: React.PointerEventHandler<HTMLElement>;
    onPointerOut?: React.PointerEventHandler<HTMLElement>;
    "aria-describedby"?: string;
  };
  const childDescribedBy = childProps["aria-describedby"];
  const mergedDescribedBy =
    associateDescription && open && paintOpen
      ? typeof childDescribedBy === "string" && childDescribedBy.trim()
        ? `${childDescribedBy} ${tipId}`
        : tipId
      : childDescribedBy;

  const onHitboxPointerOver = (e: ReactPointerEvent<HTMLSpanElement>) => {
    childProps.onPointerOver?.(e as unknown as ReactPointerEvent<HTMLElement>);
    if (e.pointerType === "touch") return;
    scheduleShow(false);
  };

  const onHitboxPointerOut = (e: ReactPointerEvent<HTMLSpanElement>) => {
    childProps.onPointerOut?.(e as unknown as ReactPointerEvent<HTMLElement>);
    if (pointerOutLeavesTarget(e.currentTarget, e.relatedTarget)) scheduleHide();
  };

  const onHitboxFocusCapture = () => {
    scheduleShow(true);
  };

  const onHitboxBlurCapture = (e: ReactFocusEvent<HTMLSpanElement>) => {
    if (pointerOutLeavesTarget(e.currentTarget, e.relatedTarget)) scheduleHide();
  };

  const setHitboxRef = (node: HTMLSpanElement | null) => {
    (triggerRef as { current: HTMLElement | null }).current = node;
  };

  const triggerChild = cloneElement(children as ReactElement<Record<string, unknown>>, {
    ref: (node: HTMLElement | null) => {
      assignRef(innerRefOf(children), node);
    },
    "aria-describedby": mergedDescribedBy,
  });

  const portal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={surfaceRef}
            id={tipId}
            role="tooltip"
            className="vigil-tooltip-surface"
            data-state={paintOpen ? "open" : "closed"}
            style={{ top: coords.top, left: coords.left }}
          >
            {content}
          </div>,
          getVigilPortalRoot(),
        )
      : null;

  return (
    <>
      <span
        ref={setHitboxRef}
        className="hg-tooltip-hitbox"
        onPointerOver={onHitboxPointerOver}
        onPointerOut={onHitboxPointerOut}
        onFocusCapture={onHitboxFocusCapture}
        onBlurCapture={onHitboxBlurCapture}
      >
        {triggerChild}
      </span>
      {portal}
    </>
  );
}
