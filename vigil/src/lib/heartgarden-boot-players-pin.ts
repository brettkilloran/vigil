/** Players boot PIN — exactly **8** characters in `HEARTGARDEN_BOOT_PIN_PLAYERS` when set. */
export function readHeartgardenPlayersBootPin(): string {
  return (process.env.HEARTGARDEN_BOOT_PIN_PLAYERS ?? "").trim();
}
