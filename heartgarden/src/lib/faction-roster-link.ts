import {
  DEMO_FACTION_ROSTER,
  type FactionRosterEntry,
  factionRosterSchema,
  parseFactionRoster,
} from "@/src/lib/faction-roster-schema";
import { generateUuidV4Fallback } from "@/src/lib/hash-utils";

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
  options?: { allowReplace?: boolean }
): LinkCharacterToFactionRosterRowResult {
  const allowReplace = options?.allowReplace ?? false;
  const idx = roster.findIndex((r) => r.id === rosterEntryId);
  if (idx === -1) {
    return {
      code: "entry_not_found",
      message: "That roster row no longer exists on this faction card.",
      ok: false,
    };
  }

  const row = roster[idx]!;
  let nextRow: FactionRosterEntry;

  if (row.kind === "unlinked") {
    const labelTrim = row.label.trim();
    const roleTrim = row.role?.trim() ?? "";
    nextRow = {
      characterItemId,
      id: row.id,
      kind: "character",
      ...(labelTrim ? { displayNameOverride: labelTrim } : {}),
      ...(roleTrim ? { roleOverride: roleTrim } : {}),
    };
  } else if (row.kind === "character") {
    if (row.characterItemId === characterItemId) {
      return { ok: true, roster };
    }
    if (!allowReplace) {
      return {
        code: "replace_blocked",
        message:
          "This roster row is already linked to another character. Unlink it in the roster or pick a different row.",
        ok: false,
      };
    }
    nextRow = { ...row, characterItemId };
  } else {
    return {
      code: "invalid_roster",
      message: "Unsupported roster entry shape.",
      ok: false,
    };
  }

  const next = roster.slice();
  next[idx] = nextRow;
  const parsed = factionRosterSchema.safeParse(next);
  if (!parsed.success) {
    return {
      code: "invalid_roster",
      message: "Roster would be invalid after linking.",
      ok: false,
    };
  }
  return { ok: true, roster: parsed.data };
}

/** Demo roster — matches XX · Archive-091 readable lab specimen (`DEMO_FACTION_ROSTER`). */
export function createDefaultFactionRosterSeed(): FactionRosterEntry[] {
  const demo = parseFactionRoster(DEMO_FACTION_ROSTER);
  if (demo?.length) {
    return demo.map((r) => ({ ...r }));
  }
  const id =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : generateUuidV4Fallback();
  return [{ id, kind: "unlinked", label: "Member" }];
}
