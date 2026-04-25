/**
 * Shared timing for multiplayer delta sync and presence.
 *
 * **TTL vs clients:** `HEARTGARDEN_PRESENCE_TTL_MS` must stay **above** heartbeat interval plus
 * network / tab-throttle skew so rows are not pruned between beats. Peer list GET runs on a
 * shorter interval than heartbeat so cursors update smoothly; pointer POSTs are throttled
 * separately. Change TTL here and in docs together — see `PLAYER_LAYER.md`.
 */
export const HEARTGARDEN_PRESENCE_TTL_MS = 120_000;

/**
 * Delta poll interval (`GET …/changes`) when you are alone in the space — fewer Neon round-trips.
 * (Former default was 8s; solo users still see remote edits faster than before.)
 */
export const HEARTGARDEN_SPACE_CHANGE_POLL_MS_SOLO = 5500;

/**
 * Delta poll when at least one **other** client has presence in this space — closer to design-tool
 * latency; still polling (no WebSocket) so expect ~2–3s worst-case after a save lands in Neon.
 */
export const HEARTGARDEN_SPACE_CHANGE_POLL_MS_COLLAB = 2200;

/** Presence heartbeat POST interval. */
export const HEARTGARDEN_PRESENCE_HEARTBEAT_MS = 25_000;

/** Peer list GET interval — drives collab-mode detection + cursor chips; slightly snappier than 4s. */
export const HEARTGARDEN_PRESENCE_PEER_POLL_MS = 3000;

/** Min interval between presence POSTs triggered by pointer movement (camera+pointer payload). */
export const HEARTGARDEN_PRESENCE_POINTER_FLUSH_MIN_MS = 2000;

/** Presence camera zoom bounds — match shell `ArchitecturalCanvasApp` MIN_ZOOM / MAX_ZOOM. */
export const HEARTGARDEN_PRESENCE_CAMERA_ZOOM_MIN = 0.3;
export const HEARTGARDEN_PRESENCE_CAMERA_ZOOM_MAX = 3;

/** Substring of the delta-poll failure message; used to clear status-bar errors when polls recover. */
export const HEARTGARDEN_COLLA_POLL_ERROR_SNIPPET = "space changes (poll)";

export const HEARTGARDEN_COLLA_POLL_FAILURE_USER_MESSAGE =
  "Could not load space changes (poll). Check network or try refreshing.";

/** Coalesce burst `GET …/graph` refreshes after delta merge / realtime. */
export const HEARTGARDEN_GRAPH_REFRESH_DEBOUNCE_MS = 450;

/**
 * When realtime WebSocket is down, still poll graph periodically so pure `item_links` writes
 * (e.g. MCP) eventually show without an item row bump in `GET …/changes`.
 */
export const HEARTGARDEN_GRAPH_REFRESH_FALLBACK_INTERVAL_MS = 55_000;
