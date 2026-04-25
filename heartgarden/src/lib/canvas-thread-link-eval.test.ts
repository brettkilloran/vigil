/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import type {
  CanvasContentEntity,
  CanvasEntity,
} from "@/src/components/foundation/architectural-types";
import {
  evaluateFactionRosterThreadLink,
  evaluateLocationCharacterThreadLink,
  resolveFactionRosterEntryIdFromDrawTarget,
  runSemanticThreadLinkEvaluation,
} from "@/src/lib/canvas-thread-link-eval";

function char(
  id: string,
  overrides: Partial<CanvasContentEntity> = {}
): CanvasEntity {
  return {
    id,
    title: "C",
    kind: "content",
    theme: "default",
    rotation: 0,
    tapeRotation: 0,
    bodyHtml: "",
    slots: { s1: { x: 0, y: 0 } },
    loreCard: { kind: "character", variant: "v11" },
    persistedItemId: id,
    ...overrides,
  } as CanvasContentEntity;
}

function fac(
  id: string,
  roster: CanvasContentEntity["factionRoster"]
): CanvasEntity {
  return {
    id,
    title: "F",
    kind: "content",
    theme: "default",
    rotation: 0,
    tapeRotation: 0,
    bodyHtml: "",
    slots: { s1: { x: 0, y: 0 } },
    loreCard: { kind: "faction", variant: "v4" },
    persistedItemId: id,
    factionRoster: roster,
  } as CanvasContentEntity;
}

function loc(
  id: string,
  overrides: Partial<CanvasContentEntity> = {}
): CanvasEntity {
  return {
    id,
    title: "L",
    kind: "content",
    theme: "default",
    rotation: 0,
    tapeRotation: 0,
    bodyHtml: "",
    slots: { s1: { x: 0, y: 0 } },
    loreCard: { kind: "location", variant: "v7" },
    persistedItemId: id,
    ...overrides,
  } as CanvasContentEntity;
}

describe("resolveFactionRosterEntryIdFromDrawTarget", () => {
  it("returns null when row host does not match an endpoint", () => {
    const row = document.createElement("div");
    row.dataset.factionRosterEntryId = "row-1";
    const node = document.createElement("div");
    node.dataset.nodeId = "wrong-node";
    node.appendChild(row);
    document.body.appendChild(node);
    expect(resolveFactionRosterEntryIdFromDrawTarget(row, "a", "b")).toBe(null);
    node.remove();
  });

  it("returns id when host matches an endpoint", () => {
    const row = document.createElement("div");
    row.dataset.factionRosterEntryId = "row-1";
    const node = document.createElement("div");
    node.dataset.nodeId = "faction-1";
    node.appendChild(row);
    document.body.appendChild(node);
    expect(
      resolveFactionRosterEntryIdFromDrawTarget(row, "faction-1", "char-1")
    ).toBe("row-1");
    node.remove();
  });
});

describe("evaluateFactionRosterThreadLink", () => {
  it("patches faction roster and character loreThreadAnchors", () => {
    const rid = "30379b08-8843-4dad-8fdc-72b0615ac163";
    const roster = [{ id: rid, kind: "unlinked" as const, label: "Member" }];
    const cId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const fId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const entities: Record<string, CanvasEntity> = {
      [cId]: char(cId),
      [fId]: fac(fId, roster),
    };
    const r = evaluateFactionRosterThreadLink(entities, cId, fId, rid);
    expect(r.kind).toBe("connect_and_patch");
    if (r.kind !== "connect_and_patch") {
      return;
    }
    const nextF = r.patch.entityUpdates[fId]?.(
      entities[fId] as CanvasContentEntity
    );
    const nextC = r.patch.entityUpdates[cId]?.(
      entities[cId] as CanvasContentEntity
    );
    expect(nextF.factionRoster?.[0]?.kind).toBe("character");
    expect(nextC.loreThreadAnchors?.primaryFactionItemId).toBe(fId);
    expect(nextC.loreThreadAnchors?.primaryFactionRosterEntryId).toBe(rid);
  });
});

describe("evaluateLocationCharacterThreadLink", () => {
  it("bidirectionally sets anchors", () => {
    const cId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const lId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const entities: Record<string, CanvasEntity> = {
      [cId]: char(cId),
      [lId]: loc(lId),
    };
    const r = evaluateLocationCharacterThreadLink(entities, cId, lId);
    expect(r.kind).toBe("connect_and_patch");
    if (r.kind !== "connect_and_patch") {
      return;
    }
    const nextC = r.patch.entityUpdates[cId]?.(
      entities[cId] as CanvasContentEntity
    );
    const nextL = r.patch.entityUpdates[lId]?.(
      entities[lId] as CanvasContentEntity
    );
    expect(nextC.loreThreadAnchors?.primaryLocationItemId).toBe(lId);
    expect(nextL.loreThreadAnchors?.linkedCharacterItemIds).toContain(cId);
  });
});

describe("runSemanticThreadLinkEvaluation", () => {
  it("returns none when rosterEntryId is set but endpoints are not faction+character", () => {
    const rid = "30379b08-8843-4dad-8fdc-72b0615ac163";
    const cId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const lId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const entities: Record<string, CanvasEntity> = {
      [cId]: char(cId),
      [lId]: loc(lId),
    };
    expect(runSemanticThreadLinkEvaluation(entities, cId, lId, rid).kind).toBe(
      "none"
    );
  });

  it("runs location when no roster id", () => {
    const cId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const lId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const entities: Record<string, CanvasEntity> = {
      [cId]: char(cId),
      [lId]: loc(lId),
    };
    const r = runSemanticThreadLinkEvaluation(entities, cId, lId, null);
    expect(r.kind).toBe("connect_and_patch");
  });

  it("patches faction when roster id matches character+faction endpoints", () => {
    const rid = "30379b08-8843-4dad-8fdc-72b0615ac163";
    const roster = [{ id: rid, kind: "unlinked" as const, label: "Member" }];
    const cId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const fId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const entities: Record<string, CanvasEntity> = {
      [cId]: char(cId),
      [fId]: fac(fId, roster),
    };
    const r = runSemanticThreadLinkEvaluation(entities, cId, fId, rid);
    expect(r.kind).toBe("connect_and_patch");
    if (r.kind !== "connect_and_patch") {
      return;
    }
    expect(r.patch.entityUpdates[fId]).toBeDefined();
    expect(r.patch.entityUpdates[cId]).toBeDefined();
  });
});
