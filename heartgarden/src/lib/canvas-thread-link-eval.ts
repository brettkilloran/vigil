/**
 * Semantic evaluation for infinite-canvas thread drawing: structured hgArch patches + graph edges.
 * Consumed by ArchitecturalCanvasApp draw-mode completion (see runSemanticThreadLinkEvaluation).
 */

import type {
  CanvasContentEntity,
  CanvasEntity,
  LoreCanvasThreadAnchors,
} from "@/src/components/foundation/architectural-types";
import { linkCharacterToFactionRosterRow } from "@/src/lib/faction-roster-link";

export function isUuidLike(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function resolvedPersistedContentItemId(entity: CanvasContentEntity): string | null {
  const id =
    entity.persistedItemId && isUuidLike(entity.persistedItemId) ? entity.persistedItemId : entity.id;
  return isUuidLike(id) ? id : null;
}

export function resolveFactionRosterEntryIdFromDrawTarget(
  target: HTMLElement,
  endpointA: string,
  endpointB: string,
): string | null {
  const row = target.closest<HTMLElement>("[data-faction-roster-entry-id]");
  if (!row) return null;
  const rosterId = row.dataset.factionRosterEntryId;
  const host = row.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
  if (!rosterId || !host || (host !== endpointA && host !== endpointB)) return null;
  return rosterId;
}

export type SemanticThreadPatch = {
  /** entity id → updater (applied in order, same graph tick) */
  entityUpdates: Record<string, (prev: CanvasContentEntity) => CanvasContentEntity>;
};

export type SemanticThreadEvalResult =
  | { kind: "none" }
  | { kind: "block"; message: string }
  | { kind: "connect_only"; notice?: string }
  | { kind: "connect_and_patch"; patch: SemanticThreadPatch };

function mergeCharFactionAnchors(
  prev: LoreCanvasThreadAnchors | undefined,
  factionPersistedId: string,
  rosterEntryId: string,
): LoreCanvasThreadAnchors {
  return {
    ...prev,
    primaryFactionItemId: factionPersistedId,
    primaryFactionRosterEntryId: rosterEntryId,
  };
}

function appendLinkedCharacterUnique(
  prev: LoreCanvasThreadAnchors | undefined,
  characterItemId: string,
): LoreCanvasThreadAnchors {
  const existing = prev?.linkedCharacterItemIds ?? [];
  const next = existing.includes(characterItemId) ? existing : [...existing, characterItemId];
  return { ...prev, linkedCharacterItemIds: next };
}

function mergeCharLocationAnchors(
  prev: LoreCanvasThreadAnchors | undefined,
  locationPersistedId: string,
): LoreCanvasThreadAnchors {
  return { ...prev, primaryLocationItemId: locationPersistedId };
}

export function evaluateFactionRosterThreadLink(
  entities: Record<string, CanvasEntity>,
  endpointA: string,
  endpointB: string,
  rosterEntryId: string | null,
): SemanticThreadEvalResult {
  if (!rosterEntryId) return { kind: "none" };
  const ea = entities[endpointA];
  const eb = entities[endpointB];
  const char =
    ea?.kind === "content" && ea.loreCard?.kind === "character"
      ? ea
      : eb?.kind === "content" && eb.loreCard?.kind === "character"
        ? eb
        : null;
  const fac =
    ea?.kind === "content" && ea.loreCard?.kind === "faction"
      ? ea
      : eb?.kind === "content" && eb.loreCard?.kind === "faction"
        ? eb
        : null;
  if (!char || !fac) return { kind: "none" };

  const characterItemId = resolvedPersistedContentItemId(char);
  if (!characterItemId) {
    return {
      kind: "connect_only",
      notice:
        "Could not link roster — this character card needs a saved item id. Try again after the card finishes syncing.",
    };
  }

  const prevRoster = fac.factionRoster ?? [];
  const result = linkCharacterToFactionRosterRow(prevRoster, rosterEntryId, characterItemId);
  if (!result.ok) {
    if (result.code === "replace_blocked") {
      return { kind: "block", message: result.message };
    }
    return { kind: "connect_only", notice: result.message };
  }
  if (JSON.stringify(result.roster) === JSON.stringify(prevRoster)) {
    return { kind: "none" };
  }

  const factionPersistedId = resolvedPersistedContentItemId(fac) ?? fac.id;
  const patch: SemanticThreadPatch = {
    entityUpdates: {
      [fac.id]: (prev) =>
        prev.kind === "content" && prev.loreCard?.kind === "faction"
          ? { ...prev, factionRoster: result.roster }
          : prev,
      [char.id]: (prev) =>
        prev.kind === "content" && prev.loreCard?.kind === "character"
          ? {
              ...prev,
              loreThreadAnchors: mergeCharFactionAnchors(
                prev.loreThreadAnchors,
                factionPersistedId,
                rosterEntryId,
              ),
            }
          : prev,
    },
  };
  return { kind: "connect_and_patch", patch };
}

export function evaluateLocationCharacterThreadLink(
  entities: Record<string, CanvasEntity>,
  endpointA: string,
  endpointB: string,
): SemanticThreadEvalResult {
  const ea = entities[endpointA];
  const eb = entities[endpointB];
  const char =
    ea?.kind === "content" && ea.loreCard?.kind === "character"
      ? ea
      : eb?.kind === "content" && eb.loreCard?.kind === "character"
        ? eb
        : null;
  const loc =
    ea?.kind === "content" && ea.loreCard?.kind === "location"
      ? ea
      : eb?.kind === "content" && eb.loreCard?.kind === "location"
        ? eb
        : null;
  if (!char || !loc) return { kind: "none" };

  const characterItemId = resolvedPersistedContentItemId(char);
  const locationItemId = resolvedPersistedContentItemId(loc);
  if (!characterItemId) {
    return {
      kind: "connect_only",
      notice:
        "Could not link location — this character card needs a saved item id. Try again after the card finishes syncing.",
    };
  }
  if (!locationItemId) {
    return {
      kind: "connect_only",
      notice:
        "Could not link location — this location card needs a saved item id. Try again after the card finishes syncing.",
    };
  }

  const charNeeds = char.loreThreadAnchors?.primaryLocationItemId !== locationItemId;
  const locNeeds = !(loc.loreThreadAnchors?.linkedCharacterItemIds ?? []).includes(characterItemId);
  if (!charNeeds && !locNeeds) {
    return { kind: "none" };
  }

  const nextCharAnchors = mergeCharLocationAnchors(char.loreThreadAnchors, locationItemId);
  const nextLocAnchors = appendLinkedCharacterUnique(loc.loreThreadAnchors, characterItemId);

  const patch: SemanticThreadPatch = {
    entityUpdates: {
      [char.id]: (prev) =>
        prev.kind === "content" && prev.loreCard?.kind === "character"
          ? { ...prev, loreThreadAnchors: nextCharAnchors }
          : prev,
      [loc.id]: (prev) =>
        prev.kind === "content" && prev.loreCard?.kind === "location"
          ? { ...prev, loreThreadAnchors: nextLocAnchors }
          : prev,
    },
  };
  return { kind: "connect_and_patch", patch };
}

/**
 * Ordered evaluators: faction roster row (when `rosterEntryId` is set), else character↔location pair.
 */
export function runSemanticThreadLinkEvaluation(
  entities: Record<string, CanvasEntity>,
  endpointA: string,
  endpointB: string,
  rosterEntryId: string | null,
): SemanticThreadEvalResult {
  if (rosterEntryId) {
    const fac = evaluateFactionRosterThreadLink(entities, endpointA, endpointB, rosterEntryId);
    if (fac.kind !== "none") return fac;
    return { kind: "none" };
  }
  return evaluateLocationCharacterThreadLink(entities, endpointA, endpointB);
}
