"use client";

import { Broom, Eye, EyeSlash, Plant, Skull } from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/src/components/ui/Button";
import { HeartgardenPinField } from "@/src/components/ui/HeartgardenPinField";

import { HEARTGARDEN_APP_VERSION_LABEL } from "@/src/lib/app-version";
import { cx } from "@/src/lib/cx";

import { ArchitecturalCanvasEffectsToggle } from "./ArchitecturalStatusBar";
import { ArchitecturalTooltip } from "./ArchitecturalTooltip";
import { VigilBootAmbientAudio, vigilBootAmbientFadeOutMs } from "./VigilBootAmbientAudio";
import type { VigilBootFlowerGardenHandle } from "./VigilBootFlowerGarden";
import { VigilBootFlowerGarden, VIGIL_BOOT_FLOWER_CELL_PX } from "./VigilBootFlowerGarden";
import styles from "./VigilAppBootScreen.module.css";

export type VigilAppBootScreenProps = {
  /** Bootstrap + fonts / surface prep — enables the entry CTA. */
  technicalReady: boolean;
  /** Fires on click (starts flow transition in parent); boot fade runs in parallel. */
  onActivate: () => void;
  /** After boot tear-down (overlay opacity first; may wait for ambient audio fade to finish). */
  onExitComplete: () => void;
  /**
   * Dedicated host inside `.viewport` (see `ArchitecturalCanvasApp` `.bootFlowerPortalHost`) — blooms sit
   * **below** `VigilFlowRevealOverlay` (z ~92); boot copy/tools stay on the high overlay stack.
   */
  flowerPortalContainer: HTMLElement | null;
  /** Same state as post-boot bottom-left effects switch (main in-viewport chrome hidden until Enter). */
  canvasEffectsEnabled: boolean;
  onCanvasEffectsEnabledChange: (next: boolean) => void;
  /** Increments when returning to auth (e.g. log out) so layered ambient remounts and restarts. */
  bootAmbientEpoch?: number;
  /** Parent calls ref.current() after log-out flushSync (same gesture as click) to satisfy autoplay policy. */
  bootAmbientPrimePlaybackRef?: MutableRefObject<(() => void) | null>;
  /** Server boot PIN gate: first click opens access console; unlock via POST /api/heartgarden/boot. */
  bootGateEnabled?: boolean;
  /** False until GET /api/heartgarden/boot has completed (disables CTA until known). */
  bootGateStatusReady?: boolean;
  /** Server misconfiguration (e.g. Players PIN without `HEARTGARDEN_PLAYER_SPACE_ID`). */
  serverConfigurationError?: string | null;
};

/**
 * “Click to enter” gate: ambient copy + **Enter the garden.** Does not auto-dismiss when technical work finishes.
 */
type FlowerPointerTool = "grow" | "poison";

/** Integer grid cells intersected by segment (client px), inclusive — keeps poison drags from skipping blooms. */
function gridCellsOnSegment(x0: number, y0: number, x1: number, y1: number, cellPx: number): [number, number][] {
  let gx0 = Math.floor(x0 / cellPx);
  let gy0 = Math.floor(y0 / cellPx);
  const gx1 = Math.floor(x1 / cellPx);
  const gy1 = Math.floor(y1 / cellPx);
  const out: [number, number][] = [];
  const dx = Math.abs(gx1 - gx0);
  const dy = -Math.abs(gy1 - gy0);
  const sx = gx0 < gx1 ? 1 : -1;
  const sy = gy0 < gy1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([gx0, gy0]);
    if (gx0 === gx1 && gy0 === gy1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      gx0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      gy0 += sy;
    }
  }
  return out;
}

/** Keep in sync with `.overlay { transition: opacity … }` in VigilAppBootScreen.module.css */
const BOOT_OVERLAY_OPACITY_MS = 720;
const BOOT_OVERLAY_OPACITY_MS_REDUCED = 120;

const HOVER_SPAWN_MIN_DIST_PX = 48;
const HOVER_SPAWN_RECENT_CAP = 16;
/** Extra half-width / half-height beyond the hero column — tight “goal” oval around copy + CTA (not a huge ring). */
const HOVER_GOAL_PAD_X_PX = 40;
const HOVER_GOAL_PAD_Y_PX = 34;
/** Fraction of spawns that use a larger ellipse so a few blooms drift farther out. */
const HOVER_SPAWN_OUTLIER_CHANCE = 0.22;
const HOVER_SPAWN_OUTLIER_SCALE_MIN = 1.06;
const HOVER_SPAWN_OUTLIER_SCALE_MAX = 1.52;

function sampleUniformInEllipse(cx: number, cy: number, rx: number, ry: number): { x: number; y: number } {
  const t = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random());
  return { x: cx + rx * r * Math.cos(t), y: cy + ry * r * Math.sin(t) };
}

/**
 * Dense, randomized fills inside an ellipse around the center cluster; occasional scaled ellipse for outliers.
 */
function pickEnterGardenHoverSpawn(
  rect: DOMRect,
  recent: { x: number; y: number }[],
  minDist: number,
): { x: number; y: number } | null {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const outlier = Math.random() < HOVER_SPAWN_OUTLIER_CHANCE;
  const scale = outlier
    ? HOVER_SPAWN_OUTLIER_SCALE_MIN +
      Math.random() * (HOVER_SPAWN_OUTLIER_SCALE_MAX - HOVER_SPAWN_OUTLIER_SCALE_MIN)
    : 1;
  const rx = (rect.width / 2 + HOVER_GOAL_PAD_X_PX) * scale;
  const ry = (rect.height / 2 + HOVER_GOAL_PAD_Y_PX) * scale;

  const ok = (x: number, y: number) => recent.every((p) => Math.hypot(p.x - x, p.y - y) >= minDist);

  for (let attempt = 0; attempt < 44; attempt++) {
    const p = sampleUniformInEllipse(cx, cy, rx, ry);
    if (ok(p.x, p.y)) return p;
  }
  return sampleUniformInEllipse(cx, cy, rx, ry);
}

/** Same ellipse + spacing as hover spawns on “Enter the garden.” (`bootCenterClusterRef` bbox). */
function spawnFlowerInEnterGardenHoverBounds(
  cluster: HTMLElement | null,
  garden: VigilBootFlowerGardenHandle | null,
  recent: { x: number; y: number }[],
): void {
  if (!cluster || !garden) return;
  const rect = cluster.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;
  const p = pickEnterGardenHoverSpawn(rect, recent, HOVER_SPAWN_MIN_DIST_PX);
  if (!p) return;
  garden.spawnAt(p.x, p.y);
  recent.push(p);
  if (recent.length > HOVER_SPAWN_RECENT_CAP) recent.splice(0, recent.length - HOVER_SPAWN_RECENT_CAP);
}

export function VigilAppBootScreen({
  technicalReady,
  onActivate,
  onExitComplete,
  flowerPortalContainer,
  canvasEffectsEnabled,
  onCanvasEffectsEnabledChange,
  bootAmbientEpoch = 0,
  bootAmbientPrimePlaybackRef,
  bootGateEnabled = false,
  bootGateStatusReady = true,
  serverConfigurationError = null,
}: VigilAppBootScreenProps) {
  const [exiting, setExiting] = useState(false);
  const [accessConsoleOpen, setAccessConsoleOpen] = useState(false);
  const [bootPinFieldKey, setBootPinFieldKey] = useState(0);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [flowerTool, setFlowerTool] = useState<FlowerPointerTool>("grow");
  /** When false, center copy + CTA are visually hidden so the flower garden can fill the view. */
  const [bootCenterCopyVisible, setBootCenterCopyVisible] = useState(true);
  const flowerGardenRef = useRef<VigilBootFlowerGardenHandle>(null);
  const flowerToolRef = useRef(flowerTool);
  const poisonDragRef = useRef(false);
  const poisonLastClientRef = useRef<{ x: number; y: number } | null>(null);
  const activateButtonRef = useRef<HTMLButtonElement | null>(null);
  const bootPinFlowerLenRef = useRef(0);
  const bootPinFlowerTimersRef = useRef<number[]>([]);

  const clearBootPinFlowerTimers = useCallback(() => {
    for (const t of bootPinFlowerTimersRef.current) window.clearTimeout(t);
    bootPinFlowerTimersRef.current = [];
  }, []);
  /** Hero column (kicker, title, CTA) — bbox for hover spawn ellipse around this block. */
  const bootCenterClusterRef = useRef<HTMLDivElement | null>(null);
  const enterGardenHoverSpawnRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recentEnterGardenSpawnsRef = useRef<{ x: number; y: number }[]>([]);
  const prefersReducedMotionRef = useRef(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const exitCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const endPoisonDrag = useCallback((el: HTMLDivElement | null, pointerId?: number) => {
    poisonDragRef.current = false;
    poisonLastClientRef.current = null;
    if (el != null && pointerId != null) {
      try {
        if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useLayoutEffect(() => {
    flowerToolRef.current = flowerTool;
  }, [flowerTool]);

  useEffect(() => {
    if (!exiting) return;
    poisonDragRef.current = false;
    poisonLastClientRef.current = null;
  }, [exiting]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      const m = mq.matches;
      prefersReducedMotionRef.current = m;
      setPrefersReducedMotion(m);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(
    () => () => {
      if (exitCompleteTimerRef.current != null) {
        clearTimeout(exitCompleteTimerRef.current);
        exitCompleteTimerRef.current = null;
      }
    },
    [],
  );

  const clearEnterGardenHoverSpawn = useCallback(() => {
    const id = enterGardenHoverSpawnRef.current;
    if (id != null) {
      clearInterval(id);
      enterGardenHoverSpawnRef.current = null;
    }
    recentEnterGardenSpawnsRef.current = [];
  }, []);

  useEffect(() => {
    if (exiting) clearEnterGardenHoverSpawn();
  }, [exiting, clearEnterGardenHoverSpawn]);

  useEffect(() => {
    if (!exiting) return;
    flowerGardenRef.current?.clearAll();
  }, [exiting]);

  useEffect(() => () => clearEnterGardenHoverSpawn(), [clearEnterGardenHoverSpawn]);

  const tickEnterGardenHoverSpawn = useCallback(() => {
    if (exiting || !technicalReady || prefersReducedMotionRef.current || !bootCenterCopyVisible) return;
    spawnFlowerInEnterGardenHoverBounds(
      bootCenterClusterRef.current,
      flowerGardenRef.current,
      recentEnterGardenSpawnsRef.current,
    );
  }, [bootCenterCopyVisible, exiting, technicalReady]);

  const onEnterGardenPointerEnter = useCallback(() => {
    if (exiting || !technicalReady || prefersReducedMotionRef.current || !bootCenterCopyVisible) return;
    if (bootGateEnabled && accessConsoleOpen) return;
    clearEnterGardenHoverSpawn();
    tickEnterGardenHoverSpawn();
    enterGardenHoverSpawnRef.current = setInterval(() => {
      tickEnterGardenHoverSpawn();
    }, 200 + Math.floor(Math.random() * 120));
  }, [
    bootGateEnabled,
    accessConsoleOpen,
    clearEnterGardenHoverSpawn,
    exiting,
    bootCenterCopyVisible,
    technicalReady,
    tickEnterGardenHoverSpawn,
  ]);

  useEffect(() => {
    if (!bootCenterCopyVisible) clearEnterGardenHoverSpawn();
  }, [bootCenterCopyVisible, clearEnterGardenHoverSpawn]);

  const onEnterGardenPointerLeave = useCallback(() => {
    clearEnterGardenHoverSpawn();
  }, [clearEnterGardenHoverSpawn]);

  const handleActivate = useCallback(() => {
    if (!technicalReady || exiting) return;
    onActivate();
    setExiting(true);
  }, [technicalReady, exiting, onActivate]);

  const openAccessConsole = useCallback(() => {
    if (!technicalReady || exiting || !bootGateStatusReady) return;
    setBootPinFieldKey((k) => k + 1);
    setAccessConsoleOpen(true);
    setPinError(null);
  }, [technicalReady, exiting, bootGateStatusReady]);

  const dismissAccessConsoleIfPinEmpty = useCallback(() => {
    const ae = document.activeElement;
    if (ae instanceof HTMLElement && ae.closest("[data-vigil-boot-access-morph]")) {
      ae.blur();
    }
    setAccessConsoleOpen(false);
    setPinError(null);
  }, []);

  const handleEnterGardenButtonClick = useCallback(() => {
    if (!technicalReady || exiting) return;
    if (bootGateEnabled) {
      if (!accessConsoleOpen) openAccessConsole();
      return;
    }
    handleActivate();
  }, [bootGateEnabled, accessConsoleOpen, technicalReady, exiting, openAccessConsole, handleActivate]);

  const submitAccessPin = useCallback(async () => {
    if (!bootGateEnabled || pinValue.length !== 8 || exiting || pinSubmitting) return;
    setPinSubmitting(true);
    setPinError(null);
    try {
      const res = await fetch("/api/heartgarden/boot", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: pinValue }),
      });
      if (res.status === 204) {
        handleActivate();
        return;
      }
      setPinError("Access denied.");
    } catch {
      setPinError("Access denied.");
    } finally {
      setPinSubmitting(false);
    }
  }, [bootGateEnabled, pinValue, exiting, pinSubmitting, handleActivate]);

  const ctaEnabled = technicalReady && !exiting && bootGateStatusReady;

  useEffect(() => {
    if (!accessConsoleOpen || exiting) {
      clearBootPinFlowerTimers();
      bootPinFlowerLenRef.current = pinValue.length;
      return;
    }
    if (!bootCenterCopyVisible) {
      clearBootPinFlowerTimers();
      bootPinFlowerLenRef.current = pinValue.length;
      return;
    }
    if (prefersReducedMotion) {
      clearBootPinFlowerTimers();
      bootPinFlowerLenRef.current = pinValue.length;
      return;
    }
    if (pinValue.length < bootPinFlowerLenRef.current) {
      clearBootPinFlowerTimers();
      bootPinFlowerLenRef.current = pinValue.length;
      return;
    }
    const prev = bootPinFlowerLenRef.current;
    if (pinValue.length > prev) {
      for (let i = prev; i < pinValue.length; i++) {
        const slot = i;
        const tid = window.setTimeout(() => {
          spawnFlowerInEnterGardenHoverBounds(
            bootCenterClusterRef.current,
            flowerGardenRef.current,
            recentEnterGardenSpawnsRef.current,
          );
        }, (slot - prev) * 40);
        bootPinFlowerTimersRef.current.push(tid);
      }
    }
    bootPinFlowerLenRef.current = pinValue.length;
  }, [
    pinValue,
    accessConsoleOpen,
    exiting,
    bootCenterCopyVisible,
    prefersReducedMotion,
    clearBootPinFlowerTimers,
  ]);

  useEffect(
    () => () => {
      clearBootPinFlowerTimers();
    },
    [clearBootPinFlowerTimers],
  );

  const onTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      if (!exiting || e.propertyName !== "opacity") return;

      if (exitCompleteTimerRef.current != null) {
        clearTimeout(exitCompleteTimerRef.current);
        exitCompleteTimerRef.current = null;
      }

      const overlayMs = prefersReducedMotion ? BOOT_OVERLAY_OPACITY_MS_REDUCED : BOOT_OVERLAY_OPACITY_MS;
      const audioMs = vigilBootAmbientFadeOutMs(prefersReducedMotion);
      const delayMs = Math.max(0, audioMs - overlayMs);

      if (delayMs === 0) {
        onExitComplete();
        return;
      }
      exitCompleteTimerRef.current = setTimeout(() => {
        exitCompleteTimerRef.current = null;
        onExitComplete();
      }, delayMs);
    },
    [exiting, onExitComplete, prefersReducedMotion],
  );

  const onOverlayPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (exiting) return;
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-vigil-boot-flower-tools]")) return;
      if (target.closest('[data-hg-chrome="canvas-effects-toggle"]')) return;
      if (target.closest("[data-vigil-boot-ambient-audio]")) return;
      if (target.closest("[data-vigil-boot-copy-toggle]")) return;
      if (
        bootGateEnabled &&
        accessConsoleOpen &&
        pinValue.length === 0 &&
        !pinSubmitting &&
        !target.closest("[data-vigil-boot-activate]")
      ) {
        dismissAccessConsoleIfPinEmpty();
      }
      if (target.closest("[data-vigil-boot-activate]")) return;
      if (flowerTool === "poison") {
        poisonDragRef.current = true;
        poisonLastClientRef.current = { x: e.clientX, y: e.clientY };
        flowerGardenRef.current?.cutAt(e.clientX, e.clientY);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }
      flowerGardenRef.current?.spawnAt(e.clientX, e.clientY);
    },
    [
      exiting,
      flowerTool,
      bootGateEnabled,
      accessConsoleOpen,
      pinValue.length,
      pinSubmitting,
      dismissAccessConsoleIfPinEmpty,
    ],
  );

  const onOverlayPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (exiting || !poisonDragRef.current || flowerToolRef.current !== "poison") return;
      if ((e.buttons & 1) === 0) return;
      const last = poisonLastClientRef.current;
      if (!last) return;
      const g = flowerGardenRef.current;
      if (!g) return;
      const cell = VIGIL_BOOT_FLOWER_CELL_PX;
      const cells = gridCellsOnSegment(last.x, last.y, e.clientX, e.clientY, cell);
      for (const [gx, gy] of cells) {
        g.cutAt(gx * cell + cell * 0.5, gy * cell + cell * 0.5);
      }
      poisonLastClientRef.current = { x: e.clientX, y: e.clientY };
    },
    [exiting],
  );

  const onOverlayPointerUpOrCancel = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      endPoisonDrag(e.currentTarget, e.pointerId);
    },
    [endPoisonDrag],
  );

  const onOverlayLostPointerCapture = useCallback(() => {
    endPoisonDrag(null);
  }, [endPoisonDrag]);

  return (
    <>
      {flowerPortalContainer
        ? createPortal(
            <div
              className={`${styles.bootFlowerDeepPlane} ${exiting ? styles.bootFlowerDeepPlaneExiting : ""}`}
              aria-hidden
            >
              <VigilBootFlowerGarden ref={flowerGardenRef} active={!exiting} />
            </div>,
            flowerPortalContainer,
          )
        : null}
      <div
        className={`${styles.overlay} ${exiting ? styles.overlayExiting : ""} ${flowerTool === "grow" ? styles.overlayPlantMode : styles.overlayPoisonMode}`}
        role="dialog"
        aria-modal="true"
        aria-label={bootCenterCopyVisible ? undefined : "Heartgarden boot — garden play mode"}
        aria-labelledby={bootCenterCopyVisible ? "vigil-boot-title" : undefined}
        onPointerDown={onOverlayPointerDown}
        onPointerMove={onOverlayPointerMove}
        onPointerUp={onOverlayPointerUpOrCancel}
        onPointerCancel={onOverlayPointerUpOrCancel}
        onLostPointerCapture={onOverlayLostPointerCapture}
        onTransitionEnd={onTransitionEnd}
      >
      <div className={styles.flowerToolsRail} data-vigil-boot-flower-tools="true">
        <div
          className={`${styles.flowerToolsPanel} ${styles.flowerToolsFade}`}
          role="toolbar"
          aria-label="Boot flower tools"
        >
          <div className={styles.flowerToolbar}>
            <ArchitecturalTooltip content="Plant flowers" side="bottom" delayMs={280}>
              <Button
                variant="ghost"
                tone="glass"
                size="icon"
                iconOnly
                isActive={flowerTool === "grow"}
                aria-label="Plant mode — click to grow flowers"
                disabled={exiting}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setFlowerTool("grow");
                }}
              >
                <Plant size={18} weight="bold" aria-hidden />
              </Button>
            </ArchitecturalTooltip>
            <ArchitecturalTooltip content="Poison — click or drag to wilt" side="bottom" delayMs={280}>
              <Button
                variant="ghost"
                tone="glass"
                size="icon"
                iconOnly
                isActive={flowerTool === "poison"}
                aria-label="Poison mode — click or drag on the garden to wilt flowers"
                disabled={exiting}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setFlowerTool("poison");
                }}
              >
                <Skull size={18} weight="bold" aria-hidden />
              </Button>
            </ArchitecturalTooltip>
            <div className={styles.flowerToolbarSep} aria-hidden />
            <ArchitecturalTooltip content="Clear all flowers" side="bottom" delayMs={280}>
              <Button
                variant="ghost"
                tone="glass"
                size="icon"
                iconOnly
                aria-label="Clear all flowers"
                disabled={exiting}
                onClick={(ev) => {
                  ev.stopPropagation();
                  flowerGardenRef.current?.clearAll();
                }}
              >
                <Broom size={18} weight="bold" aria-hidden />
              </Button>
            </ArchitecturalTooltip>
          </div>
        </div>
      </div>
      <div className={styles.metaTop}>
        <div className={styles.metaTopRightCluster}>
          <div
            className={`${styles.metaTopInner} ${styles.mono} ${styles.fadeInMetaTop}`}
            style={{ animationDelay: "0.22s" }}
          >
            <span>
              {technicalReady ? "NOMINAL · AWAIT_SESSION" : "TOPOLOGY · FONTS · VIEWPORT"}
            </span>
            <span aria-hidden> · </span>
            <span>09.03.Y394</span>
            <span className={styles.metaCursor} aria-hidden>
              _
            </span>
          </div>
        </div>
      </div>

      <div
        ref={bootCenterClusterRef}
        className={cx(styles.content, !bootCenterCopyVisible && styles.contentHidden)}
        aria-hidden={!bootCenterCopyVisible}
      >
        <div className={styles.middleCopy}>
          <div
            className={`${styles.mono} ${styles.fadeInKicker}`}
            style={{ animationDelay: "0.42s" }}
          >
            <span className={`${styles.kicker} ${styles.bootGlitchLayer}`} data-text="HEARTGARDEN">
              HEARTGARDEN
            </span>
          </div>
          <h1
            id="vigil-boot-title"
            lang="ja"
            className={`${styles.title} ${styles.titleCjk} ${styles.fadeInTitle}`}
            style={{ animationDelay: "0.58s" }}
          >
            <span className={styles.bootGlitchLayer} data-text="波途画電">
              波途画電
            </span>
          </h1>
        </div>
        <div
          className={`${styles.activateWrap} ${styles.fadeInCta}`}
          style={{ animationDelay: "1.22s" }}
          data-vigil-boot-activate="true"
        >
          {bootGateEnabled ? (
            <div
              className={cx(styles.morphHost, accessConsoleOpen && styles.morphHostConsole)}
              data-vigil-boot-access-morph="true"
            >
              <div
                className={cx(styles.morphTier, accessConsoleOpen && styles.morphTierHidden)}
                aria-hidden={accessConsoleOpen}
              >
                <Button
                  ref={activateButtonRef}
                  variant="primary"
                  tone="solid"
                  className={styles.enterGardenBtn}
                  disabled={!ctaEnabled}
                  onClick={handleEnterGardenButtonClick}
                  onPointerEnter={onEnterGardenPointerEnter}
                  onPointerLeave={onEnterGardenPointerLeave}
                >
                  Enter the garden.
                </Button>
              </div>
              <div
                className={cx(styles.morphTier, !accessConsoleOpen && styles.morphTierHidden)}
                aria-hidden={!accessConsoleOpen}
              >
                {serverConfigurationError ? (
                  <p className={styles.bootServerError} role="alert">
                    {serverConfigurationError}
                  </p>
                ) : null}
                <HeartgardenPinField
                  key={bootPinFieldKey}
                  id="vigil-boot-access-pin"
                  legend="Heartgarden access code"
                  visibleCaption="Eight-character PIN (access, demo, or players)."
                  value={pinValue}
                  onValueChange={(v) => {
                    setPinValue(v);
                    if (pinError) setPinError(null);
                  }}
                  onSubmit={submitAccessPin}
                  disabled={!technicalReady || exiting}
                  submitting={pinSubmitting}
                  errorMessage={pinError}
                  autoFocus={accessConsoleOpen}
                  onEmptyBlur={dismissAccessConsoleIfPinEmpty}
                  className={styles.bootAccessPinField}
                />
              </div>
            </div>
          ) : (
            <Button
              ref={activateButtonRef}
              variant="primary"
              tone="solid"
              className={styles.enterGardenBtn}
              disabled={!ctaEnabled}
              onClick={handleEnterGardenButtonClick}
              onPointerEnter={onEnterGardenPointerEnter}
              onPointerLeave={onEnterGardenPointerLeave}
            >
              Enter the garden.
            </Button>
          )}
          {!technicalReady ? (
            <p className={styles.waitHint} aria-live="polite">
              Provisioning render shell…
            </p>
          ) : bootGateEnabled && !bootGateStatusReady ? (
            <p className={styles.waitHint} aria-live="polite">
              Checking access…
            </p>
          ) : null}
        </div>
      </div>

      <div className={styles.metaBottom}>
        <div
          className={`${styles.metaBottomLeftCluster} ${styles.fadeInBottom}`}
          style={{ animationDelay: "1.32s" }}
        >
          <div
            className={styles.bootChromeDockPanel}
            role="toolbar"
            aria-label="Boot visual effects, copy visibility, and app audio"
          >
            <ArchitecturalCanvasEffectsToggle
              layout="bare"
              effectsEnabled={canvasEffectsEnabled}
              onEffectsEnabledChange={onCanvasEffectsEnabledChange}
            />
            <div className={styles.bootChromeDockSep} aria-hidden />
            <ArchitecturalTooltip
              content={bootCenterCopyVisible ? "Hide title and entry — play with the garden" : "Show title and entry"}
              side="top"
              delayMs={320}
            >
              <Button
                type="button"
                variant="ghost"
                tone="glass"
                size="icon"
                iconOnly
                data-vigil-boot-copy-toggle="true"
                className={cx(
                  !bootCenterCopyVisible &&
                    (prefersReducedMotion ? styles.bootCopyToggleGlowStatic : styles.bootCopyToggleGlow),
                )}
                aria-pressed={!bootCenterCopyVisible}
                aria-label={
                  bootCenterCopyVisible
                    ? "Hide title and entry — focus on the garden"
                    : "Show title and entry"
                }
                disabled={exiting}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setBootCenterCopyVisible((v) => !v);
                }}
              >
                {bootCenterCopyVisible ? (
                  <EyeSlash size={18} weight="bold" aria-hidden />
                ) : (
                  <Eye size={18} weight="bold" aria-hidden />
                )}
              </Button>
            </ArchitecturalTooltip>
            <div className={styles.bootChromeDockSep} aria-hidden />
            <VigilBootAmbientAudio
              key={bootAmbientEpoch}
              embedInChromeRow
              suspended={exiting}
              reduceMotion={prefersReducedMotion}
              primePlaybackFromGestureRef={bootAmbientPrimePlaybackRef}
            />
          </div>
          <div className={`${styles.metaBottomLeft} ${styles.mono}`}>
            Channel Stain · v.{HEARTGARDEN_APP_VERSION_LABEL}
          </div>
        </div>
        <div className={styles.metaBottomRightCluster}>
          <div className={`${styles.mono} ${styles.fadeInBottom}`} style={{ animationDelay: "1.48s" }}>
            BRETT KILLORAN
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
