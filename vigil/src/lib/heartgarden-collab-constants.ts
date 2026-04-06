/**
 * Shared timing for multiplayer delta sync and presence. Server TTL must exceed client
 * heartbeat + network skew; peer poll is cosmetic and may be slower than heartbeat.
 */
export const HEARTGARDEN_PRESENCE_TTL_MS = 120_000;

export const HEARTGARDEN_SPACE_CHANGE_POLL_MS = 8_000;
export const HEARTGARDEN_PRESENCE_HEARTBEAT_MS = 25_000;
export const HEARTGARDEN_PRESENCE_PEER_POLL_MS = 12_000;

/** Substring of the delta-poll failure message; used to clear status-bar errors when polls recover. */
export const HEARTGARDEN_COLLA_POLL_ERROR_SNIPPET = "space changes (poll)";

export const HEARTGARDEN_COLLA_POLL_FAILURE_USER_MESSAGE =
  "Could not load space changes (poll). Check network or try refreshing.";
