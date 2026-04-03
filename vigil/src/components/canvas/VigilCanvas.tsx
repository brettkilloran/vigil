"use client";

import { useEffect, useRef, useState } from "react";

import { CanvasItemView } from "@/src/components/canvas/CanvasItemView";
import { SnapGuidesOverlay } from "@/src/components/canvas/SnapGuides";
import { resizeFromHandle } from "@/src/lib/resize-rect";
import { screenToCanvas } from "@/src/lib/screen-to-canvas";
import type { SnapGuide } from "@/src/lib/snap";
import { snapRectPosition } from "@/src/lib/snap";
import { useCanvasStore } from "@/src/stores/canvas-store";
import type { CanvasItem } from "@/src/stores/canvas-types";

function visibleItems(
  items: CanvasItem[],
  camera: { x: number; y: number; zoom: number },
  vw: number,
  vh: number,
): CanvasItem[] {
  const buf = 240 / camera.zoom;
  const wx0 = -camera.x / camera.zoom - buf;
  const wy0 = -camera.y / camera.zoom - buf;
  const wx1 = (vw - camera.x) / camera.zoom + buf;
  const wy1 = (vh - camera.y) / camera.zoom + buf;
  return items.filter(
    (it) =>
      !(
        it.x + it.width < wx0 ||
        it.x > wx1 ||
        it.y + it.height < wy0 ||
        it.y > wy1
      ),
  );
}

export function VigilCanvas({
  onPatchItem,
  onCreateItemAt,
  onOpenFolder,
}: {
  onPatchItem: (id: string, patch: Partial<CanvasItem>) => void;
  onCreateItemAt: (
    world: { x: number; y: number },
    kind: "note" | "sticky",
  ) => void | Promise<void | string | null>;
  onOpenFolder?: (childSpaceId: string) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef(useCanvasStore.getState().camera);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

  const camera = useCanvasStore((s) => s.camera);
  const setCamera = useCanvasStore((s) => s.setCamera);
  const items = useCanvasStore((s) => Object.values(s.items));
  const dragging = useCanvasStore((s) => s.dragging);
  const resizing = useCanvasStore((s) => s.resizing);
  const snapEnabled = useCanvasStore((s) => s.snapEnabled);
  const patchItemLocal = useCanvasStore((s) => s.patchItemLocal);
  const endDrag = useCanvasStore((s) => s.endDrag);
  const endResize = useCanvasStore((s) => s.endResize);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const setSelectedIds = useCanvasStore((s) => s.setSelectedIds);
  const setLasso = useCanvasStore((s) => s.setLasso);
  const lasso = useCanvasStore((s) => s.lasso);

  const panRef = useRef<{
    startX: number;
    startY: number;
    camX: number;
    camY: number;
  } | null>(null);
  const lassoRef = useRef<{
    startWx: number;
    startWy: number;
  } | null>(null);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setRect(el.getBoundingClientRect());
    });
    ro.observe(el);
    setRect(el.getBoundingClientRect());
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const cam = cameraRef.current;
      if (e.ctrlKey || e.metaKey) {
        const world = screenToCanvas(e.clientX, e.clientY, r, cam);
        const factor = Math.exp(-e.deltaY * 0.0012);
        const newZoom = Math.min(8, Math.max(0.15, cam.zoom * factor));
        const lx = e.clientX - r.left;
        const ly = e.clientY - r.top;
        const newX = lx - world.x * newZoom;
        const newY = ly - world.y * newZoom;
        setCamera({ x: newX, y: newY, zoom: newZoom });
      } else {
        setCamera({
          x: cam.x - e.deltaX,
          y: cam.y - e.deltaY,
          zoom: cam.zoom,
        });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setCamera]);

  useEffect(() => {
    if (!dragging && !resizing) {
      setSnapGuides([]);
      return;
    }

    const onMove = (e: PointerEvent) => {
      const el = viewportRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cam = cameraRef.current;

      if (dragging) {
        const w = screenToCanvas(e.clientX, e.clientY, r, cam);
        const it = useCanvasStore.getState().items[dragging.itemId];
        if (!it) return;
        let nx = w.x - dragging.offsetX;
        let ny = w.y - dragging.offsetY;
        const others = Object.values(useCanvasStore.getState().items).map(
          (o) => ({
            id: o.id,
            x: o.x,
            y: o.y,
            width: o.width,
            height: o.height,
          }),
        );
        const sn = snapRectPosition(
          nx,
          ny,
          it.width,
          it.height,
          it.id,
          others,
          cam,
          snapEnabled,
        );
        nx = sn.x;
        ny = sn.y;
        setSnapGuides(sn.guides);
        patchItemLocal(it.id, { x: nx, y: ny });
        return;
      }

      if (resizing) {
        const w = screenToCanvas(e.clientX, e.clientY, r, cam);
        const dx = w.x - resizing.startPointer.x;
        const dy = w.y - resizing.startPointer.y;
        const lock = e.shiftKey;
        const next = resizeFromHandle(
          resizing.handle,
          resizing.startRect,
          dx,
          dy,
          lock,
        );
        patchItemLocal(resizing.itemId, {
          x: next.x,
          y: next.y,
          width: next.w,
          height: next.h,
        });
      }
    };

    const onUp = () => {
      if (dragging) {
        const st = useCanvasStore.getState();
        const it = st.items[dragging.itemId];
        if (it) {
          onPatchItem(it.id, { x: it.x, y: it.y });
        }
        endDrag();
      }
      if (resizing) {
        const st = useCanvasStore.getState();
        const it = st.items[resizing.itemId];
        if (it) {
          onPatchItem(it.id, {
            x: it.x,
            y: it.y,
            width: it.width,
            height: it.height,
          });
        }
        endResize();
      }
      setSnapGuides([]);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [
    dragging,
    resizing,
    endDrag,
    endResize,
    onPatchItem,
    patchItemLocal,
    snapEnabled,
  ]);

  const onBgPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const el = viewportRef.current;
    if (!el || !rect) return;
    const cam = cameraRef.current;

    if (e.shiftKey) {
      const w = screenToCanvas(e.clientX, e.clientY, rect, cam);
      lassoRef.current = { startWx: w.x, startWy: w.y };
      setLasso({ x1: w.x, y1: w.y, x2: w.x, y2: w.y });
      return;
    }

    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      camX: cam.x,
      camY: cam.y,
    };
    clearSelection();
  };

  const onBgPointerMove = (e: React.PointerEvent) => {
    if (lassoRef.current && rect) {
      const cam = cameraRef.current;
      const w = screenToCanvas(e.clientX, e.clientY, rect, cam);
      const s = lassoRef.current;
      setLasso({
        x1: s.startWx,
        y1: s.startWy,
        x2: w.x,
        y2: w.y,
      });
      return;
    }
    const p = panRef.current;
    if (!p) return;
    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;
    const camNow = cameraRef.current;
    setCamera({ x: p.camX + dx, y: p.camY + dy, zoom: camNow.zoom });
  };

  const onBgPointerUp = (e: React.PointerEvent) => {
    if (lassoRef.current && rect) {
      const cam = cameraRef.current;
      const w = screenToCanvas(e.clientX, e.clientY, rect, cam);
      const s = lassoRef.current;
      lassoRef.current = null;
      const x1 = Math.min(s.startWx, w.x);
      const x2 = Math.max(s.startWx, w.x);
      const y1 = Math.min(s.startWy, w.y);
      const y2 = Math.max(s.startWy, w.y);
      setLasso(null);
      const inside = items.filter(
        (it) =>
          it.x + it.width >= x1 &&
          it.x <= x2 &&
          it.y + it.height >= y1 &&
          it.y <= y2,
      );
      if (inside.length > 0) {
        setSelectedIds(inside.map((i) => i.id));
      }
      return;
    }
    panRef.current = null;
  };

  const onBgDoubleClick = (e: React.MouseEvent) => {
    if (!rect) return;
    const cam = cameraRef.current;
    const w = screenToCanvas(e.clientX, e.clientY, rect, cam);
    onCreateItemAt(w, "note");
  };

  const vw = rect?.width ?? 0;
  const vh = rect?.height ?? 0;

  const shown = visibleItems(items, camera, vw, vh);

  const lassoScreen =
    lasso && rect
      ? {
          left: Math.min(lasso.x1, lasso.x2) * camera.zoom + camera.x,
          top: Math.min(lasso.y1, lasso.y2) * camera.zoom + camera.y,
          width: Math.abs(lasso.x2 - lasso.x1) * camera.zoom,
          height: Math.abs(lasso.y2 - lasso.y1) * camera.zoom,
        }
      : null;

  return (
    <div
      ref={viewportRef}
      className="relative h-dvh w-dvw touch-none overflow-hidden bg-neutral-200 dark:bg-neutral-950"
      onPointerDown={onBgPointerDown}
      onPointerMove={onBgPointerMove}
      onPointerUp={onBgPointerUp}
      onPointerLeave={() => {
        panRef.current = null;
      }}
      onDoubleClick={onBgDoubleClick}
    >
      <div
        className="absolute left-0 top-0 h-full w-full origin-top-left will-change-transform"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
        }}
      >
        {shown.map((it) => (
          <CanvasItemView
            key={it.id}
            item={it}
            viewportRect={rect}
            onPatchItem={onPatchItem}
            onOpenFolder={onOpenFolder}
          />
        ))}
      </div>
      {lassoScreen ? (
        <div
          className="pointer-events-none absolute z-[5] border-2 border-dashed border-[var(--vigil-snap)] bg-blue-500/10"
          style={{
            left: lassoScreen.left,
            top: lassoScreen.top,
            width: lassoScreen.width,
            height: lassoScreen.height,
          }}
        />
      ) : null}
      {rect ? (
        <SnapGuidesOverlay
          guides={snapGuides}
          camera={camera}
          viewportWidth={rect.width}
          viewportHeight={rect.height}
        />
      ) : null}
    </div>
  );
}
