import { z } from "zod";

/**
 * Canonical key on `content_json.hgArch` for structured faction membership.
 * Priming-phase contract; bridge round-trip is a later integration step.
 */
export const FACTION_ROSTER_HG_ARCH_KEY = "factionRoster" as const;

const uuidLike = z.string().uuid();

/**
 * One roster row. `id` is stable for UI list identity (typically a random UUID).
 */
export const factionRosterEntrySchema = z.discriminatedUnion("kind", [
  z.object({
    id: uuidLike,
    kind: z.literal("character"),
    /** Target canvas / DB item id for the character lore card. */
    characterItemId: uuidLike,
    /** Optional roster-only title when the linked card title should not be shown verbatim. */
    displayNameOverride: z.string().max(400).optional(),
    roleOverride: z.string().max(400).optional(),
  }),
  z.object({
    id: uuidLike,
    kind: z.literal("unlinked"),
    label: z.string().min(1).max(400),
    role: z.string().max(400).optional(),
  }),
]);

export const factionRosterSchema = z.array(factionRosterEntrySchema);

export type FactionRosterEntry = z.infer<typeof factionRosterEntrySchema>;

/** Validated roster array, or null if missing/invalid. */
export function parseFactionRoster(raw: unknown): FactionRosterEntry[] | null {
  if (raw === undefined || raw === null) return null;
  const r = factionRosterSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Read `factionRoster` from a hgArch-like object (e.g. parsed `content_json.hgArch`). */
export function parseFactionRosterFromHgArch(hgArch: unknown): FactionRosterEntry[] | null {
  if (!hgArch || typeof hgArch !== "object") return null;
  const raw = (hgArch as Record<string, unknown>)[FACTION_ROSTER_HG_ARCH_KEY];
  return parseFactionRoster(raw);
}

/** Lab / tests: deterministic sample that passes `factionRosterSchema`. */
export const DEMO_FACTION_ROSTER: FactionRosterEntry[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "character",
    characterItemId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    displayNameOverride: "M. Vance (card title may differ)",
    roleOverride: "Warden",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    kind: "unlinked",
    label: "Adjunct counsel",
    role: "No character card",
  },
];
