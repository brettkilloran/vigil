/**
 * SND01 via snd-lib (https://snd.dev/). Honors shared app audio mute (`vigil-audio-prefs`) and reduced motion.
 *
 * **Master switch:** when `false`, no UI SFX play and snd-lib is not loaded. Boot ambient (`VigilBootAmbientAudio`) is unchanged.
 */
export const VIGIL_UI_SOUNDS_ENABLED = false;

import {
  readAppAudioMuted,
  subscribeAppAudioMuted,
} from "@/src/lib/vigil-audio-prefs";

export type VigilUiSoundKind =
  | "tap"
  | "select"
  | "button"
  | "caution"
  | "notification"
  | "celebration"
  | "toggle_on"
  | "toggle_off"
  | "transition_up"
  | "transition_down"
  | "swipe";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** UI SFX allowed (ambient uses HTML audio separately). */
export function allowUiSounds(): boolean {
  if (!VIGIL_UI_SOUNDS_ENABLED) {
    return false;
  }
  if (typeof window === "undefined") {
    return false;
  }
  if (readAppAudioMuted()) {
    return false;
  }
  if (prefersReducedMotion()) {
    return false;
  }
  return true;
}

type SndInstance = InstanceType<typeof import("snd-lib")["default"]>;

let loadPromise: Promise<SndInstance | null> | null = null;
let cachedSnd: SndInstance | null = null;
let prefsSubscribed = false;

function ensureSndMatchesGlobalPrefs(snd: SndInstance): void {
  try {
    if (allowUiSounds()) {
      snd.unmute();
    } else {
      snd.mute();
    }
  } catch {
    /* ignore */
  }
}

function subscribePrefsOnce(): void {
  if (typeof window === "undefined" || prefsSubscribed) {
    return;
  }
  prefsSubscribed = true;
  const sync = () => {
    if (cachedSnd) {
      ensureSndMatchesGlobalPrefs(cachedSnd);
    }
  };
  subscribeAppAudioMuted(sync);
  try {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", sync);
  } catch {
    /* ignore */
  }
}

function getSndInstance(): Promise<SndInstance | null> {
  subscribePrefsOnce();
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const mod = await import("snd-lib");
        const Snd = mod.default;
        const snd = new Snd({ muteOnWindowBlur: false });
        await snd.load(Snd.KITS.SND01);
        cachedSnd = snd;
        ensureSndMatchesGlobalPrefs(snd);
        return snd;
      } catch {
        return null;
      }
    })();
  }
  return loadPromise;
}

export function playVigilUiSound(kind: VigilUiSoundKind): void {
  if (!allowUiSounds()) {
    return;
  }
  getSndInstance().then((snd) => {
    if (!(snd && allowUiSounds())) {
      return;
    }
    ensureSndMatchesGlobalPrefs(snd);
    try {
      switch (kind) {
        case "tap":
          snd.playTap();
          break;
        case "select":
          snd.playSelect();
          break;
        case "button":
          snd.playButton();
          break;
        case "caution":
          snd.playCaution();
          break;
        case "notification":
          snd.playNotification();
          break;
        case "celebration":
          snd.playCelebration();
          break;
        case "toggle_on":
          snd.playToggleOn();
          break;
        case "toggle_off":
          snd.playToggleOff();
          break;
        case "transition_up":
          snd.playTransitionUp();
          break;
        case "transition_down":
          snd.playTransitionDown();
          break;
        case "swipe":
          snd.playSwipe();
          break;
        default:
          break;
      }
    } catch {
      /* ignore */
    }
  });
}
