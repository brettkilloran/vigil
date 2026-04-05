/**
 * When `HEARTGARDEN_GM_ALLOW_PLAYER_SPACE=1`, GM sessions may access the Players-only space
 * (list, CRUD, search without global exclusion). Off by default.
 */
export function isHeartgardenGmPlayerSpaceBreakGlassEnabled(): boolean {
  return (process.env.HEARTGARDEN_GM_ALLOW_PLAYER_SPACE ?? "").trim() === "1";
}
