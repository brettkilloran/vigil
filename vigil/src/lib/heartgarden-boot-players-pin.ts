import { HEARTGARDEN_BOOT_PIN_LENGTH } from "@/src/lib/heartgarden-boot-pin-constants";

/**
 * Prefer `HEARTGARDEN_BOOT_PIN_PLAYERS`; if unset or wrong length, use `HEARTGARDEN_BOOT_PIN_VISITOR`.
 * Cookie tier remains `visitor` in payloads; this is env naming only.
 */
export function readHeartgardenPlayersBootPin(): string {
  const fromPlayers = (process.env.HEARTGARDEN_BOOT_PIN_PLAYERS ?? "").trim();
  if (fromPlayers.length === HEARTGARDEN_BOOT_PIN_LENGTH) return fromPlayers;
  return (process.env.HEARTGARDEN_BOOT_PIN_VISITOR ?? "").trim();
}
