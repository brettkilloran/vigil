"use client";

import { SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type SyntheticEvent,
} from "react";

import { Button } from "@/src/components/ui/Button";

import styles from "./VigilBootAmbientAudio.module.css";

const STORAGE_KEY = "heartgarden-boot-ambient-muted";

const FOREST_SRC = "/audio/boot-forest-wind.aac";
const MUSIC_SRC = "/audio/boot-vapor-fingers.mp3";

/** Relative loudness at the gain nodes (routing via Web Audio). */
const FOREST_VOLUME = 0.42;
const MUSIC_VOLUME = 0.32;

const FADE_IN_S = 4.2;
const FADE_OUT_S = 3.4;

const FADE_IN_S_REDUCED = 0.16;
const FADE_OUT_S_REDUCED = 0.12;

/** Default fade-out length (ms); boot shell may stay mounted until this finishes after the overlay opacity transition. */
export const VIGIL_BOOT_AMBIENT_FADE_OUT_MS = Math.round(FADE_OUT_S * 1000);

export function vigilBootAmbientFadeOutMs(reduceMotion: boolean): number {
  return reduceMotion ? 120 : VIGIL_BOOT_AMBIENT_FADE_OUT_MS;
}

async function playPair(
  ctx: AudioContext | null,
  a: HTMLAudioElement,
  b: HTMLAudioElement,
): Promise<void> {
  if (ctx?.state === "suspended") {
    await ctx.resume();
  }
  await Promise.all([a.play(), b.play()]);
}

function pausePair(a: HTMLAudioElement, b: HTMLAudioElement): void {
  a.pause();
  b.pause();
}

function cancelGainAutomation(g: GainNode | null, ctx: AudioContext | null) {
  if (!g || !ctx) return;
  const t = ctx.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(g.gain.value, t);
}

/** If `loop` misses a seam on some decoders, nudge back to the start. */
function onAmbientEnded(e: SyntheticEvent<HTMLAudioElement>) {
  const el = e.currentTarget;
  el.loop = true;
  el.currentTime = 0;
  void el.play().catch(() => {
    /* ignore — user may have navigated away */
  });
}

function rafVolumeFade(
  forest: HTMLAudioElement,
  music: HTMLAudioElement,
  fromF: number,
  fromM: number,
  toF: number,
  toM: number,
  durationMs: number,
  onDone?: () => void,
): () => void {
  const t0 = performance.now();
  let raf = 0;
  const step = (now: number) => {
    const u = Math.min(1, (now - t0) / durationMs);
    forest.volume = fromF + (toF - fromF) * u;
    music.volume = fromM + (toM - fromM) * u;
    if (u < 1) {
      raf = requestAnimationFrame(step);
    } else {
      onDone?.();
    }
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

export type VigilBootAmbientAudioProps = {
  /** When true, fade out and stop (boot overlay exiting to main app). */
  suspended: boolean;
  /** Shorter fades to align with reduced-motion boot overlay (≈120ms). */
  reduceMotion?: boolean;
  /** Optional entrance animation classes from parent (e.g. boot fade-in). */
  className?: string;
  style?: CSSProperties;
};

export function VigilBootAmbientAudio({
  suspended,
  reduceMotion = false,
  className,
  style,
}: VigilBootAmbientAudioProps) {
  const fadeInS = reduceMotion ? FADE_IN_S_REDUCED : FADE_IN_S;
  const fadeOutS = reduceMotion ? FADE_OUT_S_REDUCED : FADE_OUT_S;
  const forestRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainForestRef = useRef<GainNode | null>(null);
  const gainMusicRef = useRef<GainNode | null>(null);
  const usesWebAudioRef = useRef(false);
  const fadeRafCancelRef = useRef<(() => void) | null>(null);
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [muted, setMuted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  /** Autoplay was blocked; next explicit click should start both layers. */
  const [blocked, setBlocked] = useState(false);

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
    const forest = forestRef.current;
    const music = musicRef.current;
    if (!forest || !music) return;

    clearFallbackFade();
    clearFadeOutTimer();

    if (usesWebAudioRef.current && ctx && gainForestRef.current && gainMusicRef.current) {
      const gF = gainForestRef.current;
      const gM = gainMusicRef.current;
      const t = ctx.currentTime;
      cancelGainAutomation(gF, ctx);
      cancelGainAutomation(gM, ctx);
      gF.gain.setValueAtTime(0, t);
      gM.gain.setValueAtTime(0, t);
      gF.gain.linearRampToValueAtTime(FOREST_VOLUME, t + fadeInS);
      gM.gain.linearRampToValueAtTime(MUSIC_VOLUME, t + fadeInS);
      return;
    }

    forest.volume = 0;
    music.volume = 0;
    fadeRafCancelRef.current = rafVolumeFade(
      forest,
      music,
      0,
      0,
      FOREST_VOLUME,
      MUSIC_VOLUME,
      fadeInS * 1000,
    );
  }, [clearFadeOutTimer, clearFallbackFade, fadeInS]);

  const scheduleFadeOutAndPause = useCallback(() => {
    const ctx = audioCtxRef.current;
    const forest = forestRef.current;
    const music = musicRef.current;
    if (!forest || !music) return;

    clearFallbackFade();
    clearFadeOutTimer();

    if (forest.paused && music.paused) return;

    if (usesWebAudioRef.current && ctx && gainForestRef.current && gainMusicRef.current) {
      const gF = gainForestRef.current;
      const gM = gainMusicRef.current;
      const t = ctx.currentTime;
      cancelGainAutomation(gF, ctx);
      cancelGainAutomation(gM, ctx);
      const vF = gF.gain.value;
      const vM = gM.gain.value;
      gF.gain.setValueAtTime(vF, t);
      gM.gain.setValueAtTime(vM, t);
      gF.gain.linearRampToValueAtTime(0, t + fadeOutS);
      gM.gain.linearRampToValueAtTime(0, t + fadeOutS);
      fadeOutTimerRef.current = setTimeout(() => {
        fadeOutTimerRef.current = null;
        pausePair(forest, music);
        if (gainForestRef.current && gainMusicRef.current && ctx) {
          const t1 = ctx.currentTime;
          gainForestRef.current.gain.cancelScheduledValues(t1);
          gainMusicRef.current.gain.cancelScheduledValues(t1);
          gainForestRef.current.gain.setValueAtTime(0, t1);
          gainMusicRef.current.gain.setValueAtTime(0, t1);
        }
      }, fadeOutS * 1000 + 80);
      return;
    }

    const fromF = forest.volume;
    const fromM = music.volume;
    fadeRafCancelRef.current = rafVolumeFade(
      forest,
      music,
      fromF,
      fromM,
      0,
      0,
      fadeOutS * 1000,
      () => {
        fadeRafCancelRef.current = null;
        pausePair(forest, music);
        forest.volume = FOREST_VOLUME;
        music.volume = MUSIC_VOLUME;
      },
    );
  }, [clearFadeOutTimer, clearFallbackFade, fadeOutS]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate mute preference from localStorage after mount */
    try {
      setMuted(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    const forest = forestRef.current;
    const music = musicRef.current;
    if (!forest || !music) return;

    forest.loop = true;
    music.loop = true;

    let ctx: AudioContext | null = null;
    try {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) {
        usesWebAudioRef.current = false;
        forest.volume = 0;
        music.volume = 0;
        return;
      }

      ctx = new AC();
      audioCtxRef.current = ctx;
      usesWebAudioRef.current = true;

      /*
       * Stereo passthrough: no Web Audio panning. OS “spatial” features (Windows Sonic, Dolby Atmos for
       * headphones, Apple Spatial Audio, etc.) are applied by the user’s system to the mixed output — there is
       * no standard browser API to route arbitrary <audio> into those engines per-stream.
       */
      const srcF = ctx.createMediaElementSource(forest);
      const srcM = ctx.createMediaElementSource(music);
      const gainF = ctx.createGain();
      const gainM = ctx.createGain();
      gainF.gain.value = 0;
      gainM.gain.value = 0;
      gainForestRef.current = gainF;
      gainMusicRef.current = gainM;

      forest.volume = 1;
      music.volume = 1;

      srcF.connect(gainF).connect(ctx.destination);
      srcM.connect(gainM).connect(ctx.destination);
    } catch {
      usesWebAudioRef.current = false;
      if (ctx) {
        void ctx.close();
        audioCtxRef.current = null;
      }
      gainForestRef.current = null;
      gainMusicRef.current = null;
      forest.volume = 0;
      music.volume = 0;
    }

    return () => {
      clearFallbackFade();
      clearFadeOutTimer();
      if (ctx) {
        void ctx.close();
        audioCtxRef.current = null;
      }
      gainForestRef.current = null;
      gainMusicRef.current = null;
      usesWebAudioRef.current = false;
    };
  }, [clearFadeOutTimer, clearFallbackFade]);

  const tryStart = useCallback(async () => {
    const forest = forestRef.current;
    const music = musicRef.current;
    if (!forest || !music) return;
    try {
      await playPair(audioCtxRef.current, forest, music);
      setBlocked(false);
      scheduleFadeIn();
    } catch {
      setBlocked(true);
    }
  }, [scheduleFadeIn]);

  useEffect(() => {
    if (!hydrated) return;
    if (muted || suspended) return;

    const forest = forestRef.current;
    const music = musicRef.current;
    if (!forest || !music) return;

    let cancelled = false;
    void playPair(audioCtxRef.current, forest, music)
      .then(() => {
        if (cancelled) return;
        setBlocked(false);
        scheduleFadeIn();
      })
      .catch(() => {
        if (!cancelled) setBlocked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, muted, suspended, scheduleFadeIn]);

  useEffect(() => {
    if (!suspended) return;
    scheduleFadeOutAndPause();
    return () => {
      clearFadeOutTimer();
    };
  }, [clearFadeOutTimer, scheduleFadeOutAndPause, suspended]);

  useEffect(() => {
    if (!hydrated) return;
    if (!muted) return;
    const forest = forestRef.current;
    const music = musicRef.current;
    if (!forest || !music) return;

    clearFallbackFade();
    clearFadeOutTimer();
    const ctx = audioCtxRef.current;
    if (usesWebAudioRef.current && ctx && gainForestRef.current && gainMusicRef.current) {
      cancelGainAutomation(gainForestRef.current, ctx);
      cancelGainAutomation(gainMusicRef.current, ctx);
      const t = ctx.currentTime;
      gainForestRef.current.gain.setValueAtTime(0, t);
      gainMusicRef.current.gain.setValueAtTime(0, t);
    }
    pausePair(forest, music);
    forest.volume = usesWebAudioRef.current ? 1 : FOREST_VOLUME;
    music.volume = usesWebAudioRef.current ? 1 : MUSIC_VOLUME;
  }, [clearFadeOutTimer, clearFallbackFade, hydrated, muted]);

  const onToggle = useCallback(() => {
    if (muted) {
      setMuted(false);
      try {
        localStorage.setItem(STORAGE_KEY, "0");
      } catch {
        /* ignore */
      }
      if (suspended) return;
      void tryStart();
      return;
    }

    if (blocked && !suspended) {
      void tryStart();
      return;
    }

    setMuted(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    const forest = forestRef.current;
    const music = musicRef.current;
    if (forest && music) {
      clearFallbackFade();
      clearFadeOutTimer();
      const ctx = audioCtxRef.current;
      if (usesWebAudioRef.current && ctx && gainForestRef.current && gainMusicRef.current) {
        cancelGainAutomation(gainForestRef.current, ctx);
        cancelGainAutomation(gainMusicRef.current, ctx);
        const t = ctx.currentTime;
        gainForestRef.current.gain.setValueAtTime(0, t);
        gainMusicRef.current.gain.setValueAtTime(0, t);
      }
      pausePair(forest, music);
      forest.volume = usesWebAudioRef.current ? 1 : FOREST_VOLUME;
      music.volume = usesWebAudioRef.current ? 1 : MUSIC_VOLUME;
    }
  }, [blocked, clearFadeOutTimer, clearFallbackFade, muted, suspended, tryStart]);

  const icon = muted ? (
    <SpeakerSlash size={18} weight="bold" aria-hidden />
  ) : (
    <SpeakerHigh size={18} weight="bold" aria-hidden />
  );

  const title =
    muted
      ? "Unmute ambient audio"
      : blocked
        ? "Start ambient audio (click — autoplay was blocked)"
        : "Mute ambient audio";

  const ariaLabel =
    muted
      ? "Unmute layered ambient audio on the auth screen"
      : blocked
        ? "Start ambient audio"
        : "Mute layered ambient audio on the auth screen";

  return (
    <div
      className={`${styles.wrap} ${className ?? ""}`.trim()}
      style={style}
      data-vigil-boot-ambient-audio="true"
    >
      <audio
        ref={forestRef}
        src={FOREST_SRC}
        loop
        preload="auto"
        playsInline
        aria-hidden
        data-vigil-boot-audio="forest"
        onEnded={onAmbientEnded}
      />
      <audio
        ref={musicRef}
        src={MUSIC_SRC}
        loop
        preload="auto"
        playsInline
        aria-hidden
        data-vigil-boot-audio="music"
        onEnded={onAmbientEnded}
      />
      <div className={styles.panel} role="toolbar" aria-label="Ambient audio">
        <div className={styles.toolbar}>
          <Button
            type="button"
            variant="ghost"
            tone="glass"
            size="icon"
            iconOnly
            aria-label={ariaLabel}
            title={title}
            disabled={suspended}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {icon}
          </Button>
        </div>
      </div>
    </div>
  );
}
