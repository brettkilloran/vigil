/**
 * Single user preference for **all** in-app audio: boot ambient loops + SND UI sounds.
 * Storage key is historical (`heartgarden-boot-ambient-muted`); values match existing boot behavior:
 * - `"0"` → unmuted (explicitly on)
 * - missing / other → muted by default (boot starts muted until user unmutes)
 */

export const VIGIL_APP_AUDIO_MUTED_STORAGE_KEY =
  "heartgarden-boot-ambient-muted";

/** Same-tab + cross-tab sync (storage event only fires in other tabs). */
export const VIGIL_APP_AUDIO_MUTED_EVENT = "vigil-app-audio-muted";

export function readAppAudioMuted(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    return (
      window.localStorage.getItem(VIGIL_APP_AUDIO_MUTED_STORAGE_KEY) !== "0"
    );
  } catch {
    return true;
  }
}

export function writeAppAudioMuted(muted: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      VIGIL_APP_AUDIO_MUTED_STORAGE_KEY,
      muted ? "1" : "0"
    );
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(VIGIL_APP_AUDIO_MUTED_EVENT));
}

export function subscribeAppAudioMuted(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key === VIGIL_APP_AUDIO_MUTED_STORAGE_KEY || e.key === null) {
      onChange();
    }
  };
  const onLocal = () => onChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(VIGIL_APP_AUDIO_MUTED_EVENT, onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(VIGIL_APP_AUDIO_MUTED_EVENT, onLocal);
  };
}
