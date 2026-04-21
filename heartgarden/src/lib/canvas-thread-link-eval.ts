/**
 * Semantic evaluation for infinite-canvas thread drawing: structured hgArch patches + graph edges.
 * Consumed by ArchitecturalCanvasApp draw-mode completion (see runSemanticThreadLinkEvaluation).
 */

import type {
  CanvasContentEntity,
  CanvasEntity,
  LoreCanvasThreadAnchors,
} from "@/src/components/foundation/architectural-types";
import {
  CANVAS_THREAD_SEMANTIC_RULES,
  type CanvasThreadSemanticRule,
  sortedThreadDrawShellPair,
  type ThreadDrawShell,
} from "@/src/lib/bindings-catalog";
import { linkCharacterToFactionRosterRow } from "@/src/lib/faction-roster-link";
import { isUuidLike } from "@/src/lib/uuid-like";

export { isUuidLike } from "@/src/lib/uuid-like";

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

/** Character ↔ faction thread when not targeting a roster row (card-face / employer hint). */
function mergeCharFactionDirectAnchors(
  prev: LoreCanvasThreadAnchors | undefined,
  factionPersistedId: string,
): LoreCanvasThreadAnchors {
  if (
    prev?.primaryFactionItemId &&
    prev.primaryFactionItemId !== factionPersistedId &&
    prev.primaryFactionRosterEntryId
  ) {
    return {
      ...prev,
      primaryFactionItemId: factionPersistedId,
      primaryFactionRosterEntryId: undefined,
    };
  }
  return {
    ...prev,
    primaryFactionItemId: factionPersistedId,
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

export function evaluateCharacterFactionDirectThreadLink(
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
  const fac =
    ea?.kind === "content" && ea.loreCard?.kind === "faction"
      ? ea
      : eb?.kind === "content" && eb.loreCard?.kind === "faction"
        ? eb
        : null;
  if (!char || !fac) return { kind: "none" };

  const characterItemId = resolvedPersistedContentItemId(char);
  const factionPersistedId = resolvedPersistedContentItemId(fac) ?? fac.id;
  if (!characterItemId) {
    return {
      kind: "connect_only",
      notice:
        "Could not link faction — this character card needs a saved item id. Try again after the card finishes syncing.",
    };
  }
  if (!isUuidLike(factionPersistedId)) {
    return {
      kind: "connect_only",
      notice:
        "Could not link faction — this faction card needs a saved item id. Try again after the card finishes syncing.",
    };
  }

  const prev = char.loreThreadAnchors;
  if (prev?.primaryFactionItemId === factionPersistedId) {
    return { kind: "none" };
  }

  const nextAnchors = mergeCharFactionDirectAnchors(prev, factionPersistedId);
  const patch: SemanticThreadPatch = {
    entityUpdates: {
      [char.id]: (prevE) =>
        prevE.kind === "content" && prevE.loreCard?.kind === "character"
          ? { ...prevE, loreThreadAnchors: nextAnchors }
          : prevE,
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

function threadDrawShellPairForEndpoints(
  entities: Record<string, CanvasEntity>,
  endpointA: string,
  endpointB: string,
): readonly [ThreadDrawShell, ThreadDrawShell] | null {
  const ea = entities[endpointA];
  const eb = entities[endpointB];
  if (ea?.kind !== "content" || eb?.kind !== "content") return null;
  const ka = ea.loreCard?.kind;
  const kb = eb.loreCard?.kind;
  if (ka !== "character" && ka !== "faction" && ka !== "location") return null;
  if (kb !== "character" && kb !== "faction" && kb !== "location") return null;
  return sortedThreadDrawShellPair(ka, kb);
}

function ruleMatchesEndpoints(
  rule: CanvasThreadSemanticRule,
  pair: readonly [ThreadDrawShell, ThreadDrawShell],
): boolean {
  return rule.endpointShells[0] === pair[0] && rule.endpointShells[1] === pair[1];
}

function dispatchThreadSemanticEffect(
  rule: CanvasThreadSemanticRule,
  entities: Record<string, CanvasEntity>,
  endpointA: string,
  endpointB: string,
  rosterEntryId: string | null,
): SemanticThreadEvalResult {
  switch (rule.effect) {
    case "faction_roster_row_bind":
      return evaluateFactionRosterThreadLink(entities, endpointA, endpointB, rosterEntryId);
    case "character_faction_thread_anchor":
      return evaluateCharacterFactionDirectThreadLink(entities, endpointA, endpointB);
    case "character_location_bidirectional":
      return evaluateLocationCharacterThreadLink(entities, endpointA, endpointB);
    default: {
      const _exhaustive: never = rule.effect;
      return _exhaustive;
    }
  }
}

/**
 * Dispatches draw-completion using {@link CANVAS_THREAD_SEMANTIC_RULES} in `bindings-catalog.ts`.
 *
 * **Roster phase:** when `rosterEntryId` is set, only `phase: "roster_target"` rules run; if none
 * apply (e.g. character+location), returns `{ kind: "none" }` — same as the legacy ordering.
 */
export function runSemanticThreadLinkEvaluation(
  entities: Record<string, CanvasEntity>,
  endpointA: string,
  endpointB: string,
  rosterEntryId: string | null,
): SemanticThreadEvalResult {
  const pair = threadDrawShellPairForEndpoints(entities, endpointA, endpointB);
  if (!pair) return { kind: "none" };

  const phase = rosterEntryId ? "roster_target" : "default";
  for (const rule of CANVAS_THREAD_SEMANTIC_RULES) {
    if (rule.phase !== phase) continue;
    if (!ruleMatchesEndpoints(rule, pair)) continue;
    return dispatchThreadSemanticEffect(rule, entities, endpointA, endpointB, rosterEntryId);
  }
  return { kind: "none" };
}
