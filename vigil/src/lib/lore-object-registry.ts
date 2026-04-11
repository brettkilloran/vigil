/**
 * Single mapping story: import / LLM **canonical** taxonomy → persisted `items.entity_type`
 * and lore **canvas shell** (`loreCard` inference in `architectural-db-bridge.ts`).
 *
 * Canonical kinds (`lore-import-canonical-kinds.ts`) are richer than the three lore card
 * families (character / faction / location). Only those three get dedicated shells; `npc`
 * maps to **character** for persistence so hydration matches player expectations.
 *
 * @see docs/LORE_IMPORT_KIND_MAPPING.md
 */
import type { LoreCardKind } from "@/src/components/foundation/architectural-types";
import {
  CANONICAL_ENTITY_KINDS,
  type CanonicalEntityKind,
} from "@/src/lib/lore-import-canonical-kinds";

/** True when persisted `entity_type` should infer a `loreCard` on the canvas. */
export function isLoreCardPersistedEntityType(entityType: string | null | undefined): boolean {
  if (!entityType) return false;
  return entityType === "character" || entityType === "faction" || entityType === "location";
}

/** Lore shell kind when the canvas should use character/faction/location templates; otherwise null. */
export function loreShellKindFromCanonical(kind: CanonicalEntityKind): LoreCardKind | null {
  switch (kind) {
    case "npc":
      return "character";
    case "faction":
      return "faction";
    case "location":
      return "location";
    default:
      return null;
  }
}

/**
 * Value stored in `items.entity_type` after import apply / plan commit.
 * Maps `npc` → `character` so `canvasItemToEntity` attaches the character lore card shell.
 */
export function persistedEntityTypeFromCanonical(kind: CanonicalEntityKind): string {
  const shell = loreShellKindFromCanonical(kind);
  if (shell) return shell;
  return kind;
}

/** Every canonical kind must appear in the mapping doc + this module (CI: registry-wiring test). */
export const ALL_CANONICAL_KINDS: readonly CanonicalEntityKind[] = CANONICAL_ENTITY_KINDS;
