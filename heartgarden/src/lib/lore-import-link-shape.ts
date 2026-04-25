/**
 * Endpoint-shape validator for imported `item_links`.
 *
 * The LLM outline + merge prompts name six canonical link types, each with implicit
 * expectations about the entity kinds on each side (e.g. `affiliation` belongs between
 * a character/npc and a faction). Prior to this module, nothing enforced those shapes,
 * so an LLM could emit an `affiliation` between two `lore` notes and colour the canvas
 * graph wrong. See `docs/LORE_IMPORT_AUDIT_2026-04-21.md` §4.3 / §6 (O-1).
 *
 * `coerceImportLinkType` returns the canonical link type that is safe to write given
 * the two endpoints. Shape mismatches fall back to `history` (the catch-all) with a
 * reason string that the apply path records in `importPlanWarnings`.
 *
 * Applies before AND after clarification patches (plan-build + apply) so a clarification
 * that flips a note's canonicalEntityKind still lands a sensible link type.
 */
import { normalizeLinkTypeAlias } from "@/src/lib/connection-kind-colors";

/** Narrow string for endpoint "kind" — accepts canonical kinds or persisted shells. */
export type LinkEndpointKind = string;

const CHARACTER_KINDS = new Set<string>(["character", "npc"]);
const FACTION_KINDS = new Set<string>(["faction"]);

function isCharacter(kind: LinkEndpointKind | null | undefined): boolean {
  return kind != null && CHARACTER_KINDS.has(kind);
}
function isFaction(kind: LinkEndpointKind | null | undefined): boolean {
  return kind != null && FACTION_KINDS.has(kind);
}

export const CANONICAL_IMPORT_LINK_TYPES = [
  "bond",
  "affiliation",
  "contract",
  "conflict",
  "history",
] as const;

export type CanonicalImportLinkType =
  (typeof CANONICAL_IMPORT_LINK_TYPES)[number];

/**
 * True when the given link type is allowed between the (from, to) endpoint kinds.
 * Direction-independent: `character → faction` and `faction → character` are both allowed
 * for `affiliation`.
 */
function linkTypeAcceptsEndpoints(
  linkType: CanonicalImportLinkType,
  a: LinkEndpointKind | null | undefined,
  b: LinkEndpointKind | null | undefined
): boolean {
  switch (linkType) {
    case "bond":
      return isCharacter(a) && isCharacter(b);

    case "affiliation":
      return (
        (isCharacter(a) && isFaction(b)) ||
        (isFaction(a) && isCharacter(b)) ||
        (isFaction(a) && isFaction(b))
      );

    case "contract":
      return (
        (isCharacter(a) && isFaction(b)) ||
        (isFaction(a) && isCharacter(b)) ||
        (isFaction(a) && isFaction(b)) ||
        (isCharacter(a) && isCharacter(b))
      );

    case "conflict":
      return true; // any pair: character vs character, faction vs faction, etc.

    case "history":
      return true; // catch-all — prior relationships, shared past.
  }
}

export type CoerceImportLinkTypeResult = {
  /** Canonical link type safe to persist. */
  linkType: CanonicalImportLinkType;
  /** True when the requested type was changed to fit the endpoint shapes. */
  coerced: boolean;
  /** Human-readable trace for `importPlanWarnings`; undefined when `coerced === false`. */
  reason?: string;
};

/**
 * Coerce a requested link type into one the endpoint shapes can accept.
 *
 * - `pin` is forbidden on imports (user-drawn canvas ropes only); remaps to `history`.
 * - Unknown types normalise via `normalizeLinkTypeAlias` first, then fall back to `history`.
 * - Canonical types that the endpoint shapes disallow fall back to `history` with a reason.
 */
export function coerceImportLinkType(
  fromKind: LinkEndpointKind | null | undefined,
  toKind: LinkEndpointKind | null | undefined,
  requested: string | null | undefined
): CoerceImportLinkTypeResult {
  const normalized = normalizeLinkTypeAlias(requested ?? "");

  if (normalized === "pin") {
    return {
      linkType: "history",
      coerced: true,
      reason: `Link type "pin" is reserved for canvas ropes; imports use "history" instead.`,
    };
  }

  if (
    !(CANONICAL_IMPORT_LINK_TYPES as readonly string[]).includes(normalized)
  ) {
    return {
      linkType: "history",
      coerced: true,
      reason: `Unknown link type "${String(requested ?? "")}" — falling back to "history".`,
    };
  }

  const canonical = normalized as CanonicalImportLinkType;
  if (linkTypeAcceptsEndpoints(canonical, fromKind, toKind)) {
    return { linkType: canonical, coerced: false };
  }

  return {
    linkType: "history",
    coerced: true,
    reason: `Link type "${canonical}" does not fit endpoints (${fromKind ?? "unknown"} → ${
      toKind ?? "unknown"
    }); coerced to "history".`,
  };
}
