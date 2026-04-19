import { factionRosterSchema, type FactionRosterEntry } from "@/src/lib/faction-roster-schema";

export type LinkCharacterToRosterRowFailureCode =
  | "entry_not_found"
  | "replace_blocked"
  | "invalid_roster";

export type LinkCharacterToFactionRosterRowResult =
  | { ok: true; roster: FactionRosterEntry[] }
  | { ok: false; code: LinkCharacterToRosterRowFailureCode; message: string };

/**
 * Merge a character item id onto a roster row (by stable row `id`).
 * - `unlinked` → `character`, carrying label/role into optional overrides when non-empty.
 * - `character` + same id → no-op.
 * - `character` + different id → blocked unless `allowReplace`.
 */
export function linkCharacterToFactionRosterRow(
  roster: FactionRosterEntry[],
  rosterEntryId: string,
  characterItemId: string,
  options?: { allowReplace?: boolean },
): LinkCharacterToFactionRosterRowResult {
  const allowReplace = options?.allowReplace ?? false;
  const idx = roster.findIndex((r) => r.id === rosterEntryId);
  if (idx === -1) {
    return {
      ok: false,
      code: "entry_not_found",
      message: "That roster row no longer exists on this faction card.",
    };
  }

  const row = roster[idx]!;
  let nextRow: FactionRosterEntry;

  if (row.kind === "unlinked") {
    const labelTrim = row.label.trim();
    const roleTrim = row.role?.trim() ?? "";
    nextRow = {
      id: row.id,
      kind: "character",
      characterItemId,
      ...(labelTrim ? { displayNameOverride: labelTrim } : {}),
      ...(roleTrim ? { roleOverride: roleTrim } : {}),
    };
  } else if (row.kind === "character") {
    if (row.characterItemId === characterItemId) {
      return { ok: true, roster };
    }
    if (!allowReplace) {
      return {
        ok: false,
        code: "replace_blocked",
        message:
          "This roster row is already linked to another character. Unlink it in the roster or pick a different row.",
      };
    }
    nextRow = { ...row, characterItemId };
  } else {
    return {
      ok: false,
      code: "invalid_roster",
      message: "Unsupported roster entry shape.",
    };
  }

  const next = roster.slice();
  next[idx] = nextRow;
  const parsed = factionRosterSchema.safeParse(next);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_roster",
      message: "Roster would be invalid after linking.",
    };
  }
  return { ok: true, roster: parsed.data };
}

/** One placeholder row so new faction cards can accept thread links without extra setup. */
export function createDefaultFactionRosterSeed(): FactionRosterEntry[] {
  const id =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
  return [{ id, kind: "unlinked", label: "Member" }];
}
