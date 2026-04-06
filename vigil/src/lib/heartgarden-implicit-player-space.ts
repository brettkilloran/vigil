/**
 * When no `HEARTGARDEN_PLAYER_SPACE_ID` / `HEARTGARDEN_DEFAULT_SPACE_ID` is set, Players PIN
 * sessions use a dedicated Neon row with this exact name so they never share the GM default workspace.
 * GM lists and GM space APIs hide this row by name (see `listGmWorkspaceSpaces`).
 */
export const HEARTGARDEN_IMPLICIT_PLAYER_ROOT_SPACE_NAME = "__heartgarden_player_root__";

export function isHeartgardenImplicitPlayerRootSpaceName(name: string | null | undefined): boolean {
  return (name ?? "").trim() === HEARTGARDEN_IMPLICIT_PLAYER_ROOT_SPACE_NAME;
}
