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

/** Peer count GET interval (same order of magnitude as heartbeat; not required under TTL). */
export const HEARTGARDEN_PRESENCE_PEER_POLL_MS = 12_000;

/** Substring of the delta-poll failure message; used to clear status-bar errors when polls recover. */
export const HEARTGARDEN_COLLA_POLL_ERROR_SNIPPET = "space changes (poll)";

export const HEARTGARDEN_COLLA_POLL_FAILURE_USER_MESSAGE =
  "Could not load space changes (poll). Check network or try refreshing.";
