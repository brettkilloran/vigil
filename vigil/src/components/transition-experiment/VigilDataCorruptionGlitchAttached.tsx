"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import {
  createDataCorruptionGlitchGl,
  disposeDataCorruptionGlitchGl,
  drawDataCorruptionGlitchFrame,
  tryUploadTextureFromCanvas,
  uploadSolidBgTexture,
  type DataCorruptionGlitchGl,
} from "@/src/components/transition-experiment/dataCorruptionGlitchWebgl";
import { getVigilPortalRoot } from "@/src/lib/dom-portal-root";

export type VigilDataCorruptionGlitchAttachedProps = {
  /** Element to rasterize and align the WebGL canvas over (not a DOM parent of the canvas). */
  targetRef: RefObject<HTMLElement | null>;
  backgroundRgb?: [number, number, number];
  captureIntervalMs?: number;
  /** Above Storybook panes / shell (fixed layer). */
  zIndex?: number;
};

/**
 * Same shader + snapshot pipeline as {@link VigilDataCorruptionGlitchOverlay}, but the WebGL canvas is
 * portaled to `hg-portal-root` and positioned with `fixed` + `getBoundingClientRect`. The target node is
 * **not** wrapped by the canvas in the DOM tree, so ancestor `overflow: hidden` / `border-radius` does
 * not clip the glitch layer.
 */
export function VigilDataCorruptionGlitchAttached({
  targetRef,
  backgroundRgb = [0.608, 0.702, 0.761],
  captureIntervalMs = 0,
  zIndex = 400_000,
}: VigilDataCorruptionGlitchAttachedProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(getVigilPortalRoot());
  }, []);

  const bgRgbRef = useRef(backgroundRgb);
  bgRgbRef.current = backgroundRgb;

  const glRef = useRef<DataCorruptionGlitchGl | null>(null);
  const startTimeRef = useRef(0);
  const rafRef = useRef(0);
  const captureGenRef = useRef(0);
  const textureReadyRef = useRef(false);

  const disposeGl = useCallback(() => {
    disposeDataCorruptionGlitchGl(glRef.current);
    glRef.current = null;
    textureReadyRef.current = false;
  }, []);

  useLayoutEffect(() => {
    if (!portalRoot) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = createDataCorruptionGlitchGl(canvas);
    if (!ctx) return;
    glRef.current = ctx;
    uploadSolidBgTexture(ctx, bgRgbRef.current);
    textureReadyRef.current = true;
    startTimeRef.current = performance.now();

    let width = 0;
    let height = 0;

    const syncHostToTarget = () => {
      const host = hostRef.current;
      const el = targetRef.current;
      if (!host) return false;
      if (!el || el.clientWidth < 1 || el.clientHeight < 1) {
        host.style.width = "0px";
        host.style.height = "0px";
        return false;
      }
      const r = el.getBoundingClientRect();
      host.style.left = `${r.left}px`;
      host.style.top = `${r.top}px`;
      host.style.width = `${r.width}px`;
      host.style.height = `${r.height}px`;
      return true;
    };

    const resizeCanvasBitmap = () => {
      const host = hostRef.current;
      if (!host) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(host.clientWidth * dpr));
      const h = Math.max(1, Math.floor(host.clientHeight * dpr));
      if (w === width && h === height && canvas.width === w && canvas.height === h) return;
      width = w;
      height = h;
      canvas.width = w;
      canvas.height = h;
      ctx.gl.viewport(0, 0, w, h);
    };

    const runCapture = async () => {
      const gen = ++captureGenRef.current;
      const el = targetRef.current;
      const g = glRef.current;
      if (!el || !g || el.clientWidth < 1 || el.clientHeight < 1) return;
      try {
        const { default: html2canvas } = await import("html2canvas");
        if (gen !== captureGenRef.current) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const snap = await html2canvas(el, {
          scale: dpr,
          backgroundColor: null,
          logging: false,
          useCORS: true,
          allowTaint: true,
          foreignObjectRendering: false,
        });
        if (gen !== captureGenRef.current) return;
        if (tryUploadTextureFromCanvas(g, snap)) {
          textureReadyRef.current = true;
        } else {
          uploadSolidBgTexture(g, bgRgbRef.current);
          textureReadyRef.current = true;
        }
      } catch (e) {
        console.warn("[VigilDataCorruptionGlitchAttached] html2canvas failed", e);
        uploadSolidBgTexture(g, bgRgbRef.current);
        textureReadyRef.current = true;
      }
    };

    const scheduleCapture = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          void runCapture();
        });
      });
    };

    let ro: ResizeObserver | null = null;
    const attachRo = () => {
      ro?.disconnect();
      const el = targetRef.current;
      if (!el) return;
      ro = new ResizeObserver(() => {
        syncHostToTarget();
        resizeCanvasBitmap();
        scheduleCapture();
      });
      ro.observe(el);
    };

    const onScrollOrResize = () => {
      syncHostToTarget();
      resizeCanvasBitmap();
    };

    syncHostToTarget();
    resizeCanvasBitmap();

    const bootstrap = () => {
      attachRo();
      syncHostToTarget();
      resizeCanvasBitmap();
      scheduleCapture();
    };

    if (targetRef.current) {
      bootstrap();
    } else {
      requestAnimationFrame(bootstrap);
    }

    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);

    const intervalId =
      captureIntervalMs > 0 ? window.setInterval(() => scheduleCapture(), captureIntervalMs) : null;

    const render = () => {
      const g = glRef.current;
      syncHostToTarget();
      resizeCanvasBitmap();
      if (!g || !textureReadyRef.current || width < 2 || height < 2) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }
      const t = (performance.now() - startTimeRef.current) * 0.001;
      drawDataCorruptionGlitchFrame(g, width, height, t, bgRgbRef.current);
      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
      if (intervalId !== null) window.clearInterval(intervalId);
      cancelAnimationFrame(rafRef.current);
      disposeGl();
    };
  }, [portalRoot, targetRef, captureIntervalMs, disposeGl]);

  if (!portalRoot) return null;

  return createPortal(
    <div
      ref={hostRef}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        pointerEvents: "none",
        zIndex,
        margin: 0,
        padding: 0,
        border: "none",
        background: "transparent",
      }}
      aria-hidden
    >
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", margin: 0, verticalAlign: "top" }} />
    </div>,
    portalRoot,
  );
}
