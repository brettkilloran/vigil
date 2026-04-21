import {
  PRESENCE_SIGIL_VARIANTS,
  presenceFallbackAliasForClientId,
  presenceSigilForClientId,
  sanitizePresenceDisplayName,
  type PresenceSigilVariant,
} from "@/src/lib/collab-presence-identity";

const NAME_STORAGE_SLOT = "heartgarden-presence-display-name-v1";
const SIGIL_STORAGE_SLOT = "heartgarden-presence-sigil-v1";
const NAME_PROMPTED_STORAGE_SLOT = "heartgarden-presence-name-prompted-v1";

export type PresenceProfile = {
  displayName: string | null;
  sigil: PresenceSigilVariant;
};

function safeLocalStorageGet(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / disabled storage */
  }
}

export function readPresenceProfile(clientId: string): PresenceProfile {
  const name = sanitizePresenceDisplayName(safeLocalStorageGet(NAME_STORAGE_SLOT));
  const rawSigil = safeLocalStorageGet(SIGIL_STORAGE_SLOT);
  const sigil = PRESENCE_SIGIL_VARIANTS.includes(rawSigil as PresenceSigilVariant)
    ? (rawSigil as PresenceSigilVariant)
    : presenceSigilForClientId(clientId);
  return { displayName: name, sigil };
}

export function setPresenceDisplayName(displayName: string | null): void {
  const next = sanitizePresenceDisplayName(displayName);
  if (!next) return;
  safeLocalStorageSet(NAME_STORAGE_SLOT, next);
}

export function setPresenceSigil(sigil: PresenceSigilVariant): void {
  safeLocalStorageSet(SIGIL_STORAGE_SLOT, sigil);
}

/**
 * One-time identity seed for player spaces. We intentionally avoid native browser prompts so the
 * presence onboarding can stay within Heartgarden's design system. If no name is stored yet, seed
 * a deterministic fallback alias; future in-app profile UI can overwrite it.
 */
export function maybePromptPresenceDisplayNameOnce(clientId: string | null): void {
  if (typeof window === "undefined") return;
  if (safeLocalStorageGet(NAME_PROMPTED_STORAGE_SLOT) === "1") return;
  safeLocalStorageSet(NAME_PROMPTED_STORAGE_SLOT, "1");
  if (sanitizePresenceDisplayName(safeLocalStorageGet(NAME_STORAGE_SLOT))) return;
  if (!clientId) return;
  safeLocalStorageSet(NAME_STORAGE_SLOT, presenceFallbackAliasForClientId(clientId));
}
