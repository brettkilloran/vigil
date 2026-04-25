"use client";

import { SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import {
  type CSSProperties,
  type MutableRefObject,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ARCH_TOOLTIP_AVOID_BOTTOM,
  ArchitecturalTooltip,
} from "@/src/components/foundation/architectural-tooltip";
import { Button } from "@/src/components/ui/button";
import {
  readAppAudioMuted,
  subscribeAppAudioMuted,
  writeAppAudioMuted,
} from "@/src/lib/vigil-audio-prefs";

import {
  VIGIL_BOOT_AMBIENT_LAYER_COUNT,
  VIGIL_BOOT_AMBIENT_LAYERS,
} from "./boot-ambient-layers";
import styles from "./VigilBootAmbientAudio.module.css";

const FADE_IN_S = 4.2;
const FADE_OUT_S = 3.4;

const FADE_IN_S_REDUCED = 0.16;
const FADE_OUT_S_REDUCED = 0.12;

/** Default fade-out length (ms); boot shell may stay mounted until this finishes after the overlay opacity transition. */
export const VIGIL_BOOT_AMBIENT_FADE_OUT_MS = Math.round(FADE_OUT_S * 1000);

export function vigilBootAmbientFadeOutMs(reduceMotion: boolean): number {
  return reduceMotion ? 120 : VIGIL_BOOT_AMBIENT_FADE_OUT_MS;
}

/** HTMLMediaElement.volume must stay in [0, 1]; RAF fades can undershoot from float error. */
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function getAudioElements(
  refs: (HTMLAudioElement | null)[]
): HTMLAudioElement[] | null {
  const out: HTMLAudioElement[] = [];
  for (let i = 0; i < VIGIL_BOOT_AMBIENT_LAYER_COUNT; i++) {
    const el = refs[i];
    if (!el) {
      return null;
    }
    out.push(el);
  }
  return out;
}

async function resumeAndPlayAll(
  ctx: AudioContext | null,
  elements: HTMLAudioElement[]
): Promise<void> {
  if (ctx?.state === "suspended") {
    await ctx.resume();
  }
  await Promise.all(elements.map((el) => el.play()));
}

function pauseAll(elements: HTMLAudioElement[]): void {
  for (const el of elements) {
    el.pause();
  }
}

/** Avoid InvalidStateError when catch + effect cleanup both close, or React Strict Mode remounts. */
function safeCloseAudioContext(ctx: AudioContext | null): void {
  if (!ctx || ctx.state === "closed") {
    return;
  }
  try {
    ctx.close();
  } catch {
    /* ignore */
  }
}

function cancelGainNode(g: GainNode, ctx: AudioContext): void {
  const t = ctx.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(g.gain.value, t);
}

function cancelAllGains(gains: GainNode[], ctx: AudioContext): void {
  for (const g of gains) {
    cancelGainNode(g, ctx);
  }
}

/** If `loop` misses a seam on some decoders, nudge back to the start. */
function onAmbientEnded(e: SyntheticEvent<HTMLAudioElement>): void {
  const el = e.currentTarget;
  el.loop = true;
  el.currentTime = 0;
  el.play().catch(() => {
    /* ignore — user may have navigated away */
  });
}

/** Fallback when Web Audio is unavailable: drive element.volume only (no panning). */
function rafFadeVolumes(
  elements: HTMLAudioElement[],
  from: number[],
  to: number[],
  durationMs: number,
  onDone?: () => void
): () => void {
  const t0 = performance.now();
  let raf = 0;
  const step = (now: number) => {
    const u = Math.min(1, (now - t0) / durationMs);
    for (let i = 0; i < elements.length; i++) {
      elements[i].volume = clamp01(from[i] + (to[i] - from[i]) * u);
    }
    if (u < 1) {
      raf = requestAnimationFrame(step);
    } else {
      onDone?.();
    }
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

function targetVolumes(): number[] {
  return VIGIL_BOOT_AMBIENT_LAYERS.map((l) => l.gain);
}

export interface VigilBootAmbientAudioProps {
  className?: string;
  /** Omit outer glass panel — render only the mute control for a shared chrome row (e.g. boot dock). */
  embedInChromeRow?: boolean;
  /**
   * Parent sets this; after mount the ref holds a no-arg fn that runs `tryStart` (for log-out click to call
   * synchronously after `flushSync`, inside the user-gesture stack).
   */
  primePlaybackFromGestureRef?: MutableRefObject<(() => void) | null>;
  reduceMotion?: boolean;
  style?: CSSProperties;
  suspended: boolean;
}

export function VigilBootAmbientAudio({
  suspended,
  reduceMotion = false,
  className,
  style,
  embedInChromeRow = false,
  primePlaybackFromGestureRef,
}: VigilBootAmbientAudioProps) {
  const fadeInS = reduceMotion ? FADE_IN_S_REDUCED : FADE_IN_S;
  const fadeOutS = reduceMotion ? FADE_OUT_S_REDUCED : FADE_OUT_S;

  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  /** One gain node per layer; null = Web Audio not used. */
  const webGainsRef = useRef<GainNode[] | null>(null);

  const fadeRafCancelRef = useRef<(() => void) | null>(null);
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [muted, setMuted] = useState(() => readAppAudioMuted());
  const [blocked, setBlocked] = useState(false);

  useEffect(
    () => subscribeAppAudioMuted(() => setMuted(readAppAudioMuted())),
    []
  );

  const clearFallbackFade = useCallback(() => {
    fadeRafCancelRef.current?.();
    fadeRafCancelRef.current = null;
  }, []);

  const clearFadeOutTimer = useCallback(() => {
    if (fadeOutTimerRef.current != null) {
      clearTimeout(fadeOutTimerRef.current);
      fadeOutTimerRef.current = null;
    }
  }, []);

  const scheduleFadeIn = useCallback(() => {
    const ctx = audioCtxRef.current;
    const elements = getAudioElements(audioRefs.current);
    if (!elements) {
      return;
    }

    clearFallbackFade();
    clearFadeOutTimer();

    const gains = webGainsRef.current;
    if (gains && ctx) {
      const t = ctx.currentTime;
      cancelAllGains(gains, ctx);
      for (let i = 0; i < gains.length; i++) {
        const g = gains[i];
        const peak = VIGIL_BOOT_AMBIENT_LAYERS[i].gain;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peak, t + fadeInS);
      }
      return;
    }

    const zeros = elements.map(() => 0);
    const peaks = targetVolumes();
    for (const el of elements) {
      el.volume = 0;
    }
    fadeRafCancelRef.current = rafFadeVolumes(
      elements,
      zeros,
      peaks,
      fadeInS * 1000
    );
  }, [clearFadeOutTimer, clearFallbackFade, fadeInS]);

  const scheduleFadeOutAndPause = useCallback(() => {
    const ctx = audioCtxRef.current;
    const elements = getAudioElements(audioRefs.current);
    if (!elements) {
      return;
    }

    clearFallbackFade();
    clearFadeOutTimer();

    if (elements.every((el) => el.paused)) {
      return;
    }

    const gains = webGainsRef.current;
    if (gains && ctx) {
      const t = ctx.currentTime;
      cancelAllGains(gains, ctx);
      for (const g of gains) {
        const v = g.gain.value;
        g.gain.setValueAtTime(v, t);
        g.gain.linearRampToValueAtTime(0, t + fadeOutS);
      }
      fadeOutTimerRef.current = setTimeout(
        () => {
          fadeOutTimerRef.current = null;
          pauseAll(elements);
          if (webGainsRef.current && audioCtxRef.current) {
            const t1 = audioCtxRef.current.currentTime;
            for (const g of webGainsRef.current) {
              g.gain.cancelScheduledValues(t1);
              g.gain.setValueAtTime(0, t1);
            }
          }
        },
        fadeOutS * 1000 + 80
      );
      return;
    }

    const from = elements.map((el) => clamp01(el.volume));
    const zeros = elements.map(() => 0);
    const peaks = targetVolumes();
    fadeRafCancelRef.current = rafFadeVolumes(
      elements,
      from,
      zeros,
      fadeOutS * 1000,
      () => {
        fadeRafCancelRef.current = null;
        pauseAll(elements);
        for (let i = 0; i < elements.length; i++) {
          elements[i].volume = clamp01(peaks[i]);
        }
      }
    );
  }, [clearFadeOutTimer, clearFallbackFade, fadeOutS]);

  const tryStart = useCallback(async () => {
    const elements = getAudioElements(audioRefs.current);
    if (!elements) {
      return;
    }
    try {
      await resumeAndPlayAll(audioCtxRef.current, elements);
      writeAppAudioMuted(false);
      setBlocked(false);
      scheduleFadeIn();
    } catch {
      setBlocked(true);
    }
  }, [scheduleFadeIn]);

  useLayoutEffect(() => {
    const elements = getAudioElements(audioRefs.current);
    if (!elements) {
      return;
    }

    const assignPrimePlayback = () => {
      if (primePlaybackFromGestureRef) {
        primePlaybackFromGestureRef.current = () => {
          if (readAppAudioMuted()) {
            return;
          }
          void tryStart();
        };
      }
    };

    for (const el of elements) {
      el.loop = true;
    }

    let ctx: AudioContext | null = null;
    const AC =
      typeof window === "undefined"
        ? null
        : (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext);

    try {
      if (!AC) {
        webGainsRef.current = null;
        for (const el of elements) {
          el.volume = 0;
        }
        assignPrimePlayback();
        return () => {
          if (primePlaybackFromGestureRef) {
            primePlaybackFromGestureRef.current = null;
          }
        };
      }

      ctx = new AC();
      audioCtxRef.current = ctx;

      const gains: GainNode[] = [];
      for (let i = 0; i < VIGIL_BOOT_AMBIENT_LAYER_COUNT; i++) {
        const el = elements[i];
        const spec = VIGIL_BOOT_AMBIENT_LAYERS[i];
        const src = ctx.createMediaElementSource(el);
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gains.push(gain);
        el.volume = 1;
        src.connect(gain);
        if (typeof spec.pan === "number") {
          const panner = ctx.createStereoPanner();
          panner.pan.value = spec.pan;
          gain.connect(panner).connect(ctx.destination);
        } else {
          gain.connect(ctx.destination);
        }
      }
      webGainsRef.current = gains;
    } catch {
      webGainsRef.current = null;
      if (ctx) {
        safeCloseAudioContext(ctx);
        audioCtxRef.current = null;
      }
      for (const el of elements) {
        el.volume = 0;
      }
    }

    assignPrimePlayback();

    return () => {
      if (primePlaybackFromGestureRef) {
        primePlaybackFromGestureRef.current = null;
      }
      clearFallbackFade();
      clearFadeOutTimer();
      webGainsRef.current = null;
      if (ctx) {
        safeCloseAudioContext(ctx);
        audioCtxRef.current = null;
      }
    };
  }, [
    clearFadeOutTimer,
    clearFallbackFade,
    primePlaybackFromGestureRef,
    tryStart,
  ]);

  /* useLayoutEffect: start audio in the same turn as a log-out flushSync so browser autoplay policy accepts play(). */
  useLayoutEffect(() => {
    if (muted || suspended) {
      return;
    }
    /* tryStart → setState only after await play() (microtask); rule flags any effect-invoked path that touches setState. */
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: gesture window + async blocked/fade updates */
    void tryStart();
  }, [muted, suspended, tryStart]);

  useEffect(() => {
    if (!suspended) {
      return;
    }
    scheduleFadeOutAndPause();
    return () => {
      clearFadeOutTimer();
    };
  }, [clearFadeOutTimer, scheduleFadeOutAndPause, suspended]);

  useEffect(() => {
    if (!muted) {
      return;
    }
    const elements = getAudioElements(audioRefs.current);
    if (!elements) {
      return;
    }

    clearFallbackFade();
    clearFadeOutTimer();

    const ctx = audioCtxRef.current;
    const gains = webGainsRef.current;
    if (gains && ctx) {
      cancelAllGains(gains, ctx);
      const t = ctx.currentTime;
      for (const g of gains) {
        g.gain.setValueAtTime(0, t);
      }
    }
    pauseAll(elements);

    const peaks = targetVolumes();
    const viaWebAudio =
      webGainsRef.current != null && audioCtxRef.current != null;
    for (let i = 0; i < elements.length; i++) {
      elements[i].volume = viaWebAudio ? 1 : clamp01(peaks[i]);
    }
  }, [clearFadeOutTimer, clearFallbackFade, muted]);

  const onToggle = useCallback(() => {
    if (muted) {
      writeAppAudioMuted(false);
      setMuted(false);
      if (suspended) {
        return;
      }
      void tryStart();
      return;
    }

    if (blocked && !suspended) {
      void tryStart();
      return;
    }

    writeAppAudioMuted(true);
    setMuted(true);

    const elements = getAudioElements(audioRefs.current);
    if (!elements) {
      return;
    }

    clearFallbackFade();
    clearFadeOutTimer();

    const ctx = audioCtxRef.current;
    const gains = webGainsRef.current;
    if (gains && ctx) {
      cancelAllGains(gains, ctx);
      const t = ctx.currentTime;
      for (const g of gains) {
        g.gain.setValueAtTime(0, t);
      }
    }
    pauseAll(elements);

    const peaks = targetVolumes();
    const viaWebAudio =
      webGainsRef.current != null && audioCtxRef.current != null;
    for (let i = 0; i < elements.length; i++) {
      elements[i].volume = viaWebAudio ? 1 : clamp01(peaks[i]);
    }
  }, [
    blocked,
    clearFadeOutTimer,
    clearFallbackFade,
    muted,
    suspended,
    tryStart,
  ]);

  const icon = muted ? (
    <SpeakerSlash aria-hidden size={18} weight="bold" />
  ) : (
    <SpeakerHigh aria-hidden size={18} weight="bold" />
  );

  const title = muted
    ? "Unmute audio (ambient layers and interface sounds)"
    : blocked
      ? "Start audio (click — autoplay was blocked)"
      : "Mute audio (ambient layers and interface sounds)";

  const ariaLabel = muted
    ? "Unmute layered ambient audio and interface sounds"
    : blocked
      ? "Start ambient audio"
      : "Mute layered ambient audio and interface sounds";

  const audioRefCallbacks = useMemo(
    () =>
      VIGIL_BOOT_AMBIENT_LAYERS.map((_, i) => (el: HTMLAudioElement | null) => {
        audioRefs.current[i] = el;
      }),
    []
  );

  const wrapClass =
    `${styles.wrap} ${embedInChromeRow ? styles.wrapEmbed : ""} ${className ?? ""}`.trim();

  return (
    <div
      className={wrapClass}
      data-vigil-boot-ambient-audio="true"
      onPointerDown={(e) => e.stopPropagation()}
      style={style}
    >
      <div aria-hidden className={styles.audioMount}>
        {VIGIL_BOOT_AMBIENT_LAYERS.map((layer, i) => (
          // biome-ignore lint/a11y/useMediaCaption: decorative ambient boot soundscape with no spoken content; layers are aria-hidden and the audio is purely atmospheric.
          <audio
            aria-hidden
            data-vigil-boot-audio={layer.id}
            key={layer.id}
            loop
            onEnded={onAmbientEnded}
            playsInline
            preload="auto"
            ref={audioRefCallbacks[i]}
            src={layer.src}
          />
        ))}
      </div>
      {embedInChromeRow ? (
        <ArchitecturalTooltip
          avoidSides={ARCH_TOOLTIP_AVOID_BOTTOM}
          content={title}
          delayMs={320}
          side="top"
        >
          <Button
            aria-label={ariaLabel}
            disabled={suspended}
            iconOnly
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            size="icon"
            tone="glass"
            type="button"
            variant="ghost"
          >
            {icon}
          </Button>
        </ArchitecturalTooltip>
      ) : (
        <div
          aria-label="App audio — ambient and interface sounds"
          className={styles.panel}
          role="toolbar"
        >
          <div className={styles.toolbar}>
            <ArchitecturalTooltip
              avoidSides={ARCH_TOOLTIP_AVOID_BOTTOM}
              content={title}
              delayMs={320}
              side="top"
            >
              <Button
                aria-label={ariaLabel}
                disabled={suspended}
                iconOnly
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
                size="icon"
                tone="glass"
                type="button"
                variant="ghost"
              >
                {icon}
              </Button>
            </ArchitecturalTooltip>
          </div>
        </div>
      )}
    </div>
  );
}
