/** Stable TTRPG entity kinds for plans / imports; aligns with lore-import-extract + entity_type on items. */
export const CANONICAL_ENTITY_KINDS = [
  "npc",
  "location",
  "faction",
  "quest",
  "item",
  "lore",
  "other",
] as const;

export type CanonicalEntityKind = (typeof CANONICAL_ENTITY_KINDS)[number];

export function normalizeCanonicalEntityKind(raw: string | undefined | null): CanonicalEntityKind {
  const t = (raw ?? "lore").toLowerCase().trim();
  if ((CANONICAL_ENTITY_KINDS as readonly string[]).includes(t)) return t as CanonicalEntityKind;
  return "other";
}
