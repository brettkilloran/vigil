/**
 * Players boot PIN — exactly **8** characters when set.
 * Reads `HEARTGARDEN_BOOT_PIN_PLAYERS` first; if empty, falls back to `HEARTGARDEN_BOOT_PIN_PLAYER`
 * (common Vercel typo — singular name is not read by Next otherwise).
 */
export function readHeartgardenPlayersBootPin(): string {
  const canonical = (process.env.HEARTGARDEN_BOOT_PIN_PLAYERS ?? "").trim();
  if (canonical.length > 0) return canonical;
  return (process.env.HEARTGARDEN_BOOT_PIN_PLAYER ?? "").trim();
}
