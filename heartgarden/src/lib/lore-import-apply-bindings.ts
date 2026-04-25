/**
 * Binding-hint promotion for lore-card shells on the import apply path.
 *
 * When an outline link is tagged `linkIntent: "binding_hint"`, the importer has told us
 * the relationship probably belongs in a structured `content_json.hgArch` slot on one of
 * the cards (faction roster row, character ↔ location thread anchor, etc.) rather than
 * only as a canvas thread. Rather than quietly writing those slots, we create **stubs**
 * marked `aiReview: "pending"` so the GM confirms during review. The matching
 * `item_links` row is still written alongside — the binding is additive, not a
 * replacement, per `docs/BINDINGS_CATALOG.md`.
 *
 * Entry point: `buildBindingPatchForImport` — returns a patch describing the slot +
 * value to merge into the source note's existing `hgArch` payload. Apply code calls
 * `mergeHgArchBindingPatches` to combine multiple patches before writing.
 *
 * @see docs/LORE_IMPORT_AUDIT_2026-04-21.md §4.6 and plan §7.
 */
import { randomUUID } from "node:crypto";

import type { BindingSlotId } from "@/src/lib/bindings-catalog";
import type { FactionRosterEntry } from "@/src/lib/faction-roster-schema";
import type { CanonicalEntityKind } from "@/src/lib/lore-import-canonical-kinds";

type PersistableLoreShell = "character" | "faction" | "location";

function loreShellFromCanonical(
  kind: CanonicalEntityKind | string | undefined
): PersistableLoreShell | null {
  if (kind === "npc" || kind === "character") {
    return "character";
  }
  if (kind === "faction") {
    return "faction";
  }
  if (kind === "location") {
    return "location";
  }
  return null;
}

export type BindingPatch =
  | {
      kind: "faction.factionRoster";
      /** Stub roster row appended to `hgArch.factionRoster`. */
      entry: FactionRosterEntry;
    }
  | {
      kind: "character.primaryFactions";
      factionItemId: string;
    }
  | {
      kind: "character.primaryLocations";
      locationItemId: string;
    }
  | {
      kind: "location.linkedCharacters";
      characterItemId: string;
    };

export interface BuildBindingPatchInput {
  sourceKind: CanonicalEntityKind | string | undefined;
  /** Resolved target item id (post-apply). */
  targetItemId: string;
  targetKind: CanonicalEntityKind | string | undefined;
  /** Optional target title — used for roster `displayNameOverride` hints. */
  targetTitle?: string;
}

/**
 * Map a (sourceKind, targetKind) pair to the best-fit structured binding slot.
 * Returns `null` when no canonical slot applies (e.g. faction↔faction, lore↔anything);
 * the caller keeps the `item_links` row but does not write a hgArch stub.
 *
 * Direction matters: this patch applies to the **source** note's hgArch.
 */
export function buildBindingPatchForImport(
  input: BuildBindingPatchInput
): BindingPatch | null {
  const src = loreShellFromCanonical(input.sourceKind);
  const tgt = loreShellFromCanonical(input.targetKind);
  if (!(src && tgt)) {
    return null;
  }

  if (src === "faction" && tgt === "character") {
    const entry: FactionRosterEntry = {
      characterItemId: input.targetItemId,
      id: randomUUID(),
      kind: "character",
      ...(input.targetTitle
        ? { displayNameOverride: input.targetTitle.slice(0, 400) }
        : {}),
    };
    return { entry, kind: "faction.factionRoster" };
  }

  if (src === "character" && tgt === "faction") {
    return {
      factionItemId: input.targetItemId,
      kind: "character.primaryFactions",
    };
  }

  if (src === "character" && tgt === "location") {
    return {
      kind: "character.primaryLocations",
      locationItemId: input.targetItemId,
    };
  }

  if (src === "location" && tgt === "character") {
    return {
      characterItemId: input.targetItemId,
      kind: "location.linkedCharacters",
    };
  }

  return null;
}

/**
 * Apply a list of binding patches to the source note's existing `hgArch` payload,
 * returning a new hgArch object (does not mutate `baseHgArch`). Tracks the slot ids
 * touched so the caller can mark them pending review in `entity_meta`.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: lore import merges binding patches per slot kind into hgArch, tracking touched slot ids for pending-review metadata
export function mergeHgArchBindingPatches(
  baseHgArch: Record<string, unknown> | undefined | null,
  patches: BindingPatch[]
): {
  hgArch: Record<string, unknown>;
  touchedSlots: BindingSlotId[];
} {
  const hg: Record<string, unknown> = baseHgArch ? { ...baseHgArch } : {};
  const touched = new Set<BindingSlotId>();

  for (const patch of patches) {
    switch (patch.kind) {
      case "faction.factionRoster": {
        const prev = Array.isArray(hg.factionRoster)
          ? (hg.factionRoster as FactionRosterEntry[])
          : [];
        if (
          !prev.some(
            (e) =>
              e.kind === "character" &&
              patch.entry.kind === "character" &&
              e.characterItemId === patch.entry.characterItemId
          )
        ) {
          hg.factionRoster = [...prev, patch.entry];
          touched.add("faction.factionRoster");
        }
        break;
      }
      case "character.primaryFactions":
      case "character.primaryLocations": {
        const anchorsPrev =
          hg.loreThreadAnchors && typeof hg.loreThreadAnchors === "object"
            ? { ...(hg.loreThreadAnchors as Record<string, unknown>) }
            : {};
        if (patch.kind === "character.primaryFactions") {
          if (!anchorsPrev.primaryFactionItemId) {
            anchorsPrev.primaryFactionItemId = patch.factionItemId;
            touched.add("character.primaryFactions");
          }
        } else if (!anchorsPrev.primaryLocationItemId) {
          anchorsPrev.primaryLocationItemId = patch.locationItemId;
          touched.add("character.primaryLocations");
        }
        hg.loreThreadAnchors = anchorsPrev;
        break;
      }
      case "location.linkedCharacters": {
        const anchorsPrev =
          hg.loreThreadAnchors && typeof hg.loreThreadAnchors === "object"
            ? { ...(hg.loreThreadAnchors as Record<string, unknown>) }
            : {};
        const existing = Array.isArray(anchorsPrev.linkedCharacterItemIds)
          ? (anchorsPrev.linkedCharacterItemIds as string[])
          : [];
        if (!existing.includes(patch.characterItemId)) {
          anchorsPrev.linkedCharacterItemIds = [
            ...existing,
            patch.characterItemId,
          ];
          touched.add("location.linkedCharacters");
        }
        hg.loreThreadAnchors = anchorsPrev;
        break;
      }
      default:
        break;
    }
  }

  return { hgArch: hg, touchedSlots: Array.from(touched) };
}
