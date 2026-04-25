import type { FactionRosterEntry } from "@/src/lib/faction-roster-schema";
import {
  FACTION_ROSTER_HG_ARCH_KEY,
  parseFactionRoster,
} from "@/src/lib/faction-roster-schema";
import { isUuidLike } from "@/src/lib/uuid-like";

export type LoreThreadAnchorsShape = {
  primaryLocationItemId?: string;
  primaryFactionItemId?: string;
  primaryFactionRosterEntryId?: string;
  linkedCharacterItemIds?: string[];
};

function parseHgArch(
  contentJson: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!contentJson || typeof contentJson !== "object") {
    return null;
  }
  const hg = (contentJson as { hgArch?: unknown }).hgArch;
  if (!hg || typeof hg !== "object" || Array.isArray(hg)) {
    return null;
  }
  return hg as Record<string, unknown>;
}

function rosterSummaryLines(roster: FactionRosterEntry[]): string[] {
  const lines: string[] = [];
  for (const row of roster.slice(0, 24)) {
    if (row.kind === "character") {
      lines.push(`Roster: character item ${row.characterItemId}`);
    } else {
      const label = row.label?.trim() || "Member";
      lines.push(`Roster (unlinked): ${label}`);
    }
  }
  if (roster.length > 24) {
    lines.push(`Roster: … +${roster.length - 24} more rows`);
  }
  return lines;
}

function anchorsSummary(a: LoreThreadAnchorsShape): string[] {
  const lines: string[] = [];
  if (a.primaryLocationItemId) {
    lines.push(`Primary location item: ${a.primaryLocationItemId}`);
  }
  if (a.primaryFactionItemId) {
    lines.push(`Primary faction item: ${a.primaryFactionItemId}`);
  }
  if (a.primaryFactionRosterEntryId) {
    lines.push(`Faction roster entry: ${a.primaryFactionRosterEntryId}`);
  }
  if (a.linkedCharacterItemIds?.length) {
    lines.push(
      `Linked character items: ${a.linkedCharacterItemIds.slice(0, 12).join(", ")}`
    );
    if (a.linkedCharacterItemIds.length > 12) {
      lines.push(
        `… +${a.linkedCharacterItemIds.length - 12} more character links`
      );
    }
  }
  return lines;
}

/** UUIDs referenced by hgArch binding slots (roster, thread anchors, planned multi-value fields). */
export function extractHgArchBoundItemIds(
  contentJson: Record<string, unknown> | null | undefined
): string[] {
  const hg = parseHgArch(contentJson);
  if (!hg) {
    return [];
  }

  const out = new Set<string>();

  const roster = parseFactionRoster(hg[FACTION_ROSTER_HG_ARCH_KEY]);
  if (roster) {
    for (const row of roster) {
      if (row.kind === "character" && isUuidLike(row.characterItemId)) {
        out.add(row.characterItemId);
      }
    }
  }

  const anchorsRaw = hg.loreThreadAnchors;
  if (
    anchorsRaw &&
    typeof anchorsRaw === "object" &&
    !Array.isArray(anchorsRaw)
  ) {
    const a = anchorsRaw as LoreThreadAnchorsShape;
    if (isUuidLike(a.primaryLocationItemId)) {
      out.add(a.primaryLocationItemId);
    }
    if (isUuidLike(a.primaryFactionItemId)) {
      out.add(a.primaryFactionItemId);
    }
    for (const id of a.linkedCharacterItemIds ?? []) {
      if (isUuidLike(id)) {
        out.add(id);
      }
    }
  }

  return [...out];
}

/**
 * Stable, human-readable binding summary for FTS helpers and vector embed text.
 * Keeps UUIDs so retrieval can tie back to graph rows without inventing prose.
 */
export function buildHgArchBindingSummaryText(
  contentJson: Record<string, unknown> | null | undefined
): string {
  const hg = parseHgArch(contentJson);
  if (!hg) {
    return "";
  }

  const parts: string[] = ["Structured card fields (hgArch):"];

  const rosterRaw = hg[FACTION_ROSTER_HG_ARCH_KEY];
  const roster = parseFactionRoster(rosterRaw);
  if (roster?.length) {
    parts.push(...rosterSummaryLines(roster));
  }

  const anchorsRaw = hg.loreThreadAnchors;
  if (
    anchorsRaw &&
    typeof anchorsRaw === "object" &&
    !Array.isArray(anchorsRaw)
  ) {
    const a = anchorsRaw as LoreThreadAnchorsShape;
    const alines = anchorsSummary(a);
    if (alines.length) {
      parts.push(...alines);
    }
  }

  if (parts.length <= 1) {
    return "";
  }
  return parts.join("\n").trim();
}
