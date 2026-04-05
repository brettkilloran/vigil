"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";

import {
  DATA_CORRUPTION_GLITCH_DOM_ACID,
  DATA_CORRUPTION_GLITCH_DOM_BITMAP,
} from "@/src/components/transition-experiment/dataCorruptionGlitchShaders";
import {
  createDataCorruptionGlitchGl,
  disposeDataCorruptionGlitchGl,
  drawDataCorruptionGlitchFrame,
  tryUploadTextureFromCanvas,
  uploadSolidBgTexture,
  type DataCorruptionGlitchGl,
} from "@/src/components/transition-experiment/dataCorruptionGlitchWebgl";

import styles from "./VigilDataCorruptionGlitchOverlay.module.css";

export type VigilDataCorruptionGlitchOverlayProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /**
   * RGB in 0–1. Should match the visible background behind captured content so the shader’s
   * `bgColor` path lines up with the snapshot (see original demo `--bg-base` ≈ #9bb3c2).
   */
  backgroundRgb?: [number, number, number];
  /**
   * How often to re-snapshot the DOM with html2canvas.
   * **Default `0`** = only on mount and when the wrapper resizes (matches the original demo: static
   * texture, motion entirely from `u_time` in the fragment shader). Values &gt; 0 opt in to polling
   * for live-updating children; that work competes with `requestAnimationFrame` and will make the
   * glitch feel choppy.
   */
  captureIntervalMs?: number;
  /**
   * `0` = flat `textColor` ink like the HTML snippet (white-on-transparent textures). `1` = chroma from
   * the bitmap (html2canvas UI).
   */
  bitmapMode?: number;
  /** Scales the `0.85` acid mix on torn strips; use &lt; 1 for opaque DOM snapshots. */
  acidIntensity?: number;
};

export function VigilDataCorruptionGlitchOverlay({
  children,
  className,
  style,
  backgroundRgb = [0.608, 0.702, 0.761],
  captureIntervalMs = 0,
  bitmapMode = DATA_CORRUPTION_GLITCH_DOM_BITMAP,
  acidIntensity = DATA_CORRUPTION_GLITCH_DOM_ACID,
}: VigilDataCorruptionGlitchOverlayProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const captureRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const glRef = useRef<DataCorruptionGlitchGl | null>(null);

  const bgRgbRef = useRef<[number, number, number]>(backgroundRgb);
  bgRgbRef.current = backgroundRgb;
  const bitmapModeRef = useRef(bitmapMode);
  bitmapModeRef.current = bitmapMode;
  const acidIntensityRef = useRef(acidIntensity);
  acidIntensityRef.current = acidIntensity;

  const startTimeRef = useRef(0);
  const rafRef = useRef(0);
  const captureGenRef = useRef(0);
  const textureReadyRef = useRef(false);

  const disposeGl = useCallback(() => {
    disposeDataCorruptionGlitchGl(glRef.current);
    glRef.current = null;
    textureReadyRef.current = false;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const captureEl = captureRef.current;
    if (!canvas || !captureEl) return;

    const ctx = createDataCorruptionGlitchGl(canvas);
    if (!ctx) return;
    glRef.current = ctx;

    uploadSolidBgTexture(ctx, bgRgbRef.current);
    textureReadyRef.current = true;

    startTimeRef.current = performance.now();

    let width = 0;
    let height = 0;

    const resizeCanvas = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(wrap.clientWidth * dpr));
      const h = Math.max(1, Math.floor(wrap.clientHeight * dpr));
      width = w;
      height = h;
      canvas.width = w;
      canvas.height = h;
      ctx.gl.viewport(0, 0, w, h);
    };

    const runCapture = async () => {
      const gen = ++captureGenRef.current;
      const el = captureRef.current;
      if (!el || el.clientWidth < 1 || el.clientHeight < 1) return;
      const g = glRef.current;
      if (!g) return;

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
        console.warn("[VigilDataCorruptionGlitch] html2canvas failed", e);
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

    resizeCanvas();
    scheduleCapture();

    const ro = new ResizeObserver(() => {
      resizeCanvas();
      scheduleCapture();
    });
    ro.observe(wrapRef.current!);

    const intervalId =
      captureIntervalMs > 0 ? window.setInterval(() => scheduleCapture(), captureIntervalMs) : null;

    const render = () => {
      const g = glRef.current;
      if (!g || !textureReadyRef.current || width < 2 || height < 2) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      const t = (performance.now() - startTimeRef.current) * 0.001;
      drawDataCorruptionGlitchFrame(
        g,
        width,
        height,
        t,
        bgRgbRef.current,
        bitmapModeRef.current,
        acidIntensityRef.current,
      );
      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      ro.disconnect();
      if (intervalId !== null) window.clearInterval(intervalId);
      cancelAnimationFrame(rafRef.current);
      disposeGl();
    };
  }, [captureIntervalMs, disposeGl]);

  return (
    <div ref={wrapRef} className={`${styles.wrap}${className ? ` ${className}` : ""}`} style={style}>
      <div ref={captureRef} className={styles.capture}>
        {children}
      </div>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden />
    </div>
  );
}
