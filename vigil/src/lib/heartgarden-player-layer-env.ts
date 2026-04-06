import { HEARTGARDEN_BOOT_PIN_LENGTH } from "@/src/lib/heartgarden-boot-pin-constants";
import { readHeartgardenPlayersBootPin } from "@/src/lib/heartgarden-boot-players-pin";
import { parseSpaceIdParam } from "@/src/lib/space-id";

/** True when Players PIN is configured (8 chars) but `HEARTGARDEN_PLAYER_SPACE_ID` is missing or not a UUID. */
export function isHeartgardenPlayerLayerMisconfigured(): boolean {
  const playersPin = readHeartgardenPlayersBootPin();
  if (playersPin.length !== HEARTGARDEN_BOOT_PIN_LENGTH) return false;
  const raw = (process.env.HEARTGARDEN_PLAYER_SPACE_ID ?? "").trim();
  return !parseSpaceIdParam(raw || null);
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
        text: "heartgarden: HEARTGARDEN_BOOT_PIN_PLAYERS is set but HEARTGARDEN_PLAYER_SPACE_ID is missing or not a valid UUID.",
      }),
      signal: ac.signal,
    });
  } catch {
    /* ignore */
  } finally {
    clearTimeout(t);
  }
}
