import type { CanvasGraph } from "@/src/components/foundation/architectural-types";

export type FolderPopOutEntityMove = {
  entityId: string;
  fromSpaceId: string;
  toSpaceId: string;
  newSlot: { x: number; y: number };
};

export type FolderPopOutSpaceReparent = {
  spaceId: string;
  newParentId: string;
};

export type FolderPopOutPlan = {
  entityMoves: FolderPopOutEntityMove[];
  spaceReparents: FolderPopOutSpaceReparent[];
  folderEntityIds: string[];
  emptiedSpaceIds: string[];
};

function findContainingSpaceId(
  graph: CanvasGraph,
  entityId: string
): string | null {
  for (const space of Object.values(graph.spaces)) {
    if (space.entityIds.includes(entityId)) {
      return space.id;
    }
  }
  return null;
}

export function collectFolderPopOutPlan(
  graph: CanvasGraph,
  folderIds: string[]
): FolderPopOutPlan {
  const entityMoves: FolderPopOutEntityMove[] = [];
  const spaceReparents: FolderPopOutSpaceReparent[] = [];
  const folderEntityIds: string[] = [];
  const emptiedSpaceIds = new Set<string>();
  const movedEntityIds = new Set<string>();
  const reparentSpaceIds = new Set<string>();

  for (const folderId of folderIds) {
    const folder = graph.entities[folderId];
    if (!folder || folder.kind !== "folder") {
      continue;
    }
    const parentSpaceId = findContainingSpaceId(graph, folder.id);
    if (!parentSpaceId) {
      continue;
    }
    const folderSlot = folder.slots[parentSpaceId] ?? { x: 0, y: 0 };
    const childSpace = graph.spaces[folder.childSpaceId];
    if (!childSpace) {
      continue;
    }
    folderEntityIds.push(folder.id);
    emptiedSpaceIds.add(childSpace.id);

    for (const childId of childSpace.entityIds) {
      const child = graph.entities[childId];
      if (!child || movedEntityIds.has(child.id)) {
        continue;
      }
      const childSlot = child.slots[childSpace.id] ?? { x: 0, y: 0 };
      entityMoves.push({
        entityId: child.id,
        fromSpaceId: childSpace.id,
        toSpaceId: parentSpaceId,
        newSlot: {
          x: Math.round(folderSlot.x + childSlot.x),
          y: Math.round(folderSlot.y + childSlot.y),
        },
      });
      movedEntityIds.add(child.id);
      if (child.kind !== "folder") {
        continue;
      }
      if (!reparentSpaceIds.has(child.childSpaceId)) {
        spaceReparents.push({
          spaceId: child.childSpaceId,
          newParentId: parentSpaceId,
        });
        reparentSpaceIds.add(child.childSpaceId);
      }
    }
  }

  return {
    entityMoves,
    spaceReparents,
    folderEntityIds,
    emptiedSpaceIds: [...emptiedSpaceIds],
  };
}

export function applyFolderPopOutPlan(
  graph: CanvasGraph,
  plan: FolderPopOutPlan
): CanvasGraph {
  const next: CanvasGraph = {
    ...graph,
    spaces: { ...graph.spaces },
    entities: { ...graph.entities },
    connections: { ...graph.connections },
  };

  for (const move of plan.entityMoves) {
    const entity = next.entities[move.entityId];
    const fromSpace = next.spaces[move.fromSpaceId];
    const toSpace = next.spaces[move.toSpaceId];
    if (!(entity && fromSpace && toSpace)) {
      continue;
    }

    const fromIds = fromSpace.entityIds.filter((id) => id !== move.entityId);
    const toIds = toSpace.entityIds.includes(move.entityId)
      ? toSpace.entityIds
      : [...toSpace.entityIds, move.entityId];
    const restSlots = { ...entity.slots };
    delete restSlots[move.fromSpaceId];

    next.spaces[move.fromSpaceId] = { ...fromSpace, entityIds: fromIds };
    next.spaces[move.toSpaceId] = { ...toSpace, entityIds: toIds };
    next.entities[move.entityId] = {
      ...entity,
      slots: {
        ...restSlots,
        [move.toSpaceId]: move.newSlot,
      },
    };
  }

  for (const reparent of plan.spaceReparents) {
    const space = next.spaces[reparent.spaceId];
    if (!space) {
      continue;
    }
    next.spaces[reparent.spaceId] = {
      ...space,
      parentSpaceId: reparent.newParentId,
    };
  }

  return next;
}
