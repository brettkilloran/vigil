import { HEARTGARDEN_BOOT_PIN_LENGTH } from "@/src/lib/heartgarden-boot-pin-constants";
import { readHeartgardenPlayersBootPin } from "@/src/lib/heartgarden-boot-players-pin";
import { parseSpaceIdParam } from "@/src/lib/space-id";

/**
 * Explicit player space UUID from env (optional). Order: `HEARTGARDEN_PLAYER_SPACE_ID`, then
 * `HEARTGARDEN_DEFAULT_SPACE_ID` (same as MCP default-space convention).
 */
export function resolveHeartgardenPlayerSpaceIdFromEnv(): string | undefined {
  const playerRaw = (process.env.HEARTGARDEN_PLAYER_SPACE_ID ?? "").trim();
  const fromPlayer = parseSpaceIdParam(playerRaw || null);
  if (fromPlayer) return fromPlayer;
  const defaultRaw = (process.env.HEARTGARDEN_DEFAULT_SPACE_ID ?? "").trim();
  return parseSpaceIdParam(defaultRaw || null) ?? undefined;
}

/**
 * True when Players PIN is configured (8 chars) but an operator set a **non-empty** env value that
 * is not a valid UUID. Empty/missing vars are OK: the server resolves the default workspace space
 * from Neon (same as Bishop’s landing space when `HEARTGARDEN_PLAYER_SPACE_ID` is unset).
 */
export function isHeartgardenPlayerLayerMisconfigured(): boolean {
  const playersPin = readHeartgardenPlayersBootPin();
  if (playersPin.length !== HEARTGARDEN_BOOT_PIN_LENGTH) return false;
  const playerRaw = (process.env.HEARTGARDEN_PLAYER_SPACE_ID ?? "").trim();
  if (playerRaw.length > 0 && !parseSpaceIdParam(playerRaw)) return true;
  const defaultRaw = (process.env.HEARTGARDEN_DEFAULT_SPACE_ID ?? "").trim();
  if (defaultRaw.length > 0 && !parseSpaceIdParam(defaultRaw)) return true;
  return false;
}

let lastPlayerLayerMisconfigAlertMs = 0;
const MISCONFIG_ALERT_THROTTLE_MS = 15 * 60 * 1000;

/**
 * POST JSON to `HEARTGARDEN_PLAYER_LAYER_ALERT_WEBHOOK_URL` at most once per 15 minutes per process
 * (Slack/Discord/generic webhook). No-op if env unset.
 */
export async function firePlayerLayerMisconfigAlertOnce(misconfigured: boolean): Promise<void> {
  if (!misconfigured) return;
  const url = (process.env.HEARTGARDEN_PLAYER_LAYER_ALERT_WEBHOOK_URL ?? "").trim();
  if (!url) return;
  const now = Date.now();
  if (now - lastPlayerLayerMisconfigAlertMs < MISCONFIG_ALERT_THROTTLE_MS) return;
  lastPlayerLayerMisconfigAlertMs = now;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "heartgarden: HEARTGARDEN_BOOT_PIN_PLAYERS (or HEARTGARDEN_BOOT_PIN_PLAYER) is set but HEARTGARDEN_PLAYER_SPACE_ID or HEARTGARDEN_DEFAULT_SPACE_ID is set to a non-empty value that is not a valid UUID.",
      }),
      signal: ac.signal,
    });
  } catch {
    /* ignore */
  } finally {
    clearTimeout(t);
  }
}
