/**
 * Shared timing for multiplayer delta sync and presence.
 *
 * **TTL vs clients:** `HEARTGARDEN_PRESENCE_TTL_MS` must stay **above** heartbeat interval plus
 * network / tab-throttle skew so rows are not pruned between beats. Peer poll can be slower than
 * heartbeat (cosmetic count only). Change TTL here and in docs together — see `PLAYER_LAYER.md`.
 */
export const HEARTGARDEN_PRESENCE_TTL_MS = 120_000;

/** Delta poll interval (`GET …/changes`). */
export const HEARTGARDEN_SPACE_CHANGE_POLL_MS = 8_000;

/** Presence heartbeat POST interval. */
export const HEARTGARDEN_PRESENCE_HEARTBEAT_MS = 25_000;

/** Peer list GET interval — cursors feel less frozen than a 12s poll. */
export const HEARTGARDEN_PRESENCE_PEER_POLL_MS = 4000;

/** Min interval between presence POSTs triggered by pointer movement (camera+pointer payload). */
export const HEARTGARDEN_PRESENCE_POINTER_FLUSH_MIN_MS = 2000;

/** Hide remote pointer if the peer row is older than this (pointer may be stale even if row is in TTL). */
export const HEARTGARDEN_PRESENCE_POINTER_STALE_MS = 10_000;

/** Presence camera zoom bounds — match shell `ArchitecturalCanvasApp` MIN_ZOOM / MAX_ZOOM. */
export const HEARTGARDEN_PRESENCE_CAMERA_ZOOM_MIN = 0.3;
export const HEARTGARDEN_PRESENCE_CAMERA_ZOOM_MAX = 3;

/** Substring of the delta-poll failure message; used to clear status-bar errors when polls recover. */
export const HEARTGARDEN_COLLA_POLL_ERROR_SNIPPET = "space changes (poll)";

export const HEARTGARDEN_COLLA_POLL_FAILURE_USER_MESSAGE =
  "Could not load space changes (poll). Check network or try refreshing.";
