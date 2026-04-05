"use client";

import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function ArchitecturalTooltip({
  content,
  children,
  side = "top",
  delayMs = 480,
  disabled = false,
  /** When true, `aria-describedby` points at the tooltip while open (e.g. long help vs short label). */
  associateDescription = false,
}: {
  content: ReactNode;
  children: ReactElement<{
    ref?: Ref<HTMLElement>;
    onPointerEnter?: React.PointerEventHandler<HTMLElement>;
    onPointerLeave?: React.PointerEventHandler<HTMLElement>;
    onFocus?: React.FocusEventHandler<HTMLElement>;
    onBlur?: React.FocusEventHandler<HTMLElement>;
    "aria-describedby"?: string;
  }>;
  side?: Side;
  delayMs?: number;
  disabled?: boolean;
  associateDescription?: boolean;
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
      const order: Side[] =
        side === "top"
          ? ["top", "bottom", "right", "left"]
          : side === "bottom"
            ? ["bottom", "top", "right", "left"]
            : side === "left"
              ? ["left", "right", "top", "bottom"]
              : ["right", "left", "top", "bottom"];

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
  }, [side]);

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
      setPaintOpen(false);
      return;
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

  useEffect(
    () => () => {
      clearShowTimer();
    },
    [clearShowTimer],
  );

  const childDescribedBy = children.props["aria-describedby"];
  const mergedDescribedBy =
    associateDescription && open && paintOpen
      ? typeof childDescribedBy === "string" && childDescribedBy.trim()
        ? `${childDescribedBy} ${tipId}`
        : tipId
      : childDescribedBy;

  const trigger = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      (triggerRef as { current: HTMLElement | null }).current = node;
      assignRef((children as ReactElement<{ ref?: Ref<HTMLElement> }>).ref, node);
    },
    onPointerEnter: (e: React.PointerEvent<HTMLElement>) => {
      children.props.onPointerEnter?.(e);
      scheduleShow(false);
    },
    onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
      children.props.onPointerLeave?.(e);
      scheduleHide();
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      children.props.onFocus?.(e);
      scheduleShow(true);
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      children.props.onBlur?.(e);
      scheduleHide();
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
      {trigger}
      {portal}
    </>
  );
}
