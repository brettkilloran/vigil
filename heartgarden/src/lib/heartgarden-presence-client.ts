import { isUuidLike } from "@/src/lib/uuid-like";

const STORAGE_KEY = "heartgarden-presence-client-id";

/** Per-tab id for soft presence heartbeats (no accounts). */
export function getOrCreatePresenceClientId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (isUuidLike(existing)) {
      return existing;
    }
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      const id = crypto.randomUUID();
      window.sessionStorage.setItem(STORAGE_KEY, id);
      return id;
    }
  } catch {
    /* private mode */
  }
  return null;
}
