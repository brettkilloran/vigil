import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { CameraState, CanvasItem, UndoAction } from "@/src/stores/canvas-types";
import { defaultCamera } from "@/src/stores/canvas-types";

export type ResizeHandle =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

interface CanvasStoreState {
  spaceId: string | null;
  camera: CameraState;
  items: Record<string, CanvasItem>;
  selectedIds: string[];
  snapEnabled: boolean;
  dragging: { itemId: string; offsetX: number; offsetY: number } | null;
  resizing: {
    itemId: string;
    handle: ResizeHandle;
    startRect: { x: number; y: number; w: number; h: number };
    startPointer: { x: number; y: number };
  } | null;
  lasso: { x1: number; y1: number; x2: number; y2: number } | null;
  undoStack: UndoAction[];
  redoStack: UndoAction[];
  scratchPadOpen: boolean;
}

type CanvasStoreActions = {
  reset: () => void;
  hydrate: (input: {
    spaceId: string | null;
    items: CanvasItem[];
    camera: CameraState;
  }) => void;
  setCamera: (camera: CameraState) => void;
  setSnapEnabled: (v: boolean) => void;
  setScratchPadOpen: (v: boolean) => void;
  selectOnly: (id: string | null) => void;
  toggleSelect: (id: string) => void;
  setSelectedIds: (ids: string[]) => void;
  clearSelection: () => void;
  putItem: (item: CanvasItem) => void;
  patchItemLocal: (id: string, patch: Partial<CanvasItem>) => void;
  removeItemLocal: (id: string) => void;
  startDrag: (
    itemId: string,
    offsetX: number,
    offsetY: number,
    recordUndo?: boolean,
  ) => void;
  endDrag: () => void;
  startResize: (
    itemId: string,
    handle: ResizeHandle,
    startRect: { x: number; y: number; w: number; h: number },
    startPointer: { x: number; y: number },
  ) => void;
  endResize: () => void;
  setLasso: (
    rect: { x1: number; y1: number; x2: number; y2: number } | null,
  ) => void;
  pushUndo: (action: UndoAction) => void;
  undo: () => void;
  redo: () => void;
};

const initialState = (): CanvasStoreState => ({
  spaceId: null,
  camera: defaultCamera(),
  items: {},
  selectedIds: [],
  snapEnabled: true,
  dragging: null,
  resizing: null,
  lasso: null,
  undoStack: [],
  redoStack: [],
  scratchPadOpen: false,
});

export const useCanvasStore = create<CanvasStoreState & CanvasStoreActions>()(
  immer((set) => ({
    ...initialState(),

    reset: () => set(initialState()),

    hydrate: ({ spaceId, items: list, camera }) =>
      set((s) => {
        s.spaceId = spaceId;
        s.camera = { ...camera };
        s.items = {};
        for (const it of list) s.items[it.id] = { ...it };
        s.selectedIds = [];
        s.dragging = null;
        s.resizing = null;
        s.lasso = null;
        s.undoStack = [];
        s.redoStack = [];
      }),

    setCamera: (camera) =>
      set((s) => {
        s.camera = { ...camera };
      }),

    setSnapEnabled: (v) =>
      set((s) => {
        s.snapEnabled = v;
      }),

    setScratchPadOpen: (v) =>
      set((s) => {
        s.scratchPadOpen = v;
      }),

    selectOnly: (id) =>
      set((s) => {
        s.selectedIds = id ? [id] : [];
      }),

    toggleSelect: (id) =>
      set((s) => {
        const i = s.selectedIds.indexOf(id);
        if (i >= 0) s.selectedIds.splice(i, 1);
        else s.selectedIds.push(id);
      }),

    setSelectedIds: (ids) =>
      set((s) => {
        s.selectedIds = [...ids];
      }),

    clearSelection: () =>
      set((s) => {
        s.selectedIds = [];
      }),

    putItem: (item) =>
      set((s) => {
        s.items[item.id] = { ...item };
      }),

    patchItemLocal: (id, patch) =>
      set((s) => {
        const cur = s.items[id];
        if (!cur) return;
        Object.assign(cur, patch);
      }),

    removeItemLocal: (id) =>
      set((s) => {
        delete s.items[id];
        s.selectedIds = s.selectedIds.filter((x) => x !== id);
      }),

    startDrag: (itemId, offsetX, offsetY, recordUndo) =>
      set((s) => {
        if (recordUndo) {
          const it = s.items[itemId];
          if (it) {
            s.undoStack.push({
              kind: "move",
              itemId,
              before: { x: it.x, y: it.y },
              after: { x: it.x, y: it.y },
            });
            s.redoStack = [];
          }
        }
        s.dragging = { itemId, offsetX, offsetY };
      }),

    endDrag: () =>
      set((s) => {
        if (s.dragging && s.undoStack.length > 0) {
          const last = s.undoStack[s.undoStack.length - 1];
          const d = s.dragging;
          if (last?.kind === "move" && last.itemId === d.itemId) {
            const it = s.items[d.itemId];
            if (it) last.after = { x: it.x, y: it.y };
          }
        }
        s.dragging = null;
      }),

    startResize: (itemId, handle, startRect, startPointer) =>
      set((s) => {
        s.resizing = { itemId, handle, startRect, startPointer };
      }),

    endResize: () =>
      set((s) => {
        s.resizing = null;
      }),

    setLasso: (rect) =>
      set((s) => {
        s.lasso = rect ? { ...rect } : null;
      }),

    pushUndo: (action) =>
      set((s) => {
        s.undoStack.push(action);
        if (s.undoStack.length > 200) s.undoStack.shift();
        s.redoStack = [];
      }),

    undo: () =>
      set((s) => {
        const a = s.undoStack.pop();
        if (!a) return;
        if (a.kind === "move") {
          const it = s.items[a.itemId];
          if (it) {
            it.x = a.before.x;
            it.y = a.before.y;
          }
        } else if (a.kind === "create") {
          delete s.items[a.item.id];
        } else if (a.kind === "delete") {
          s.items[a.item.id] = { ...a.item };
        } else if (a.kind === "patch") {
          const it = s.items[a.itemId];
          if (it) Object.assign(it, a.before);
        }
        s.redoStack.push(a);
      }),

    redo: () =>
      set((s) => {
        const a = s.redoStack.pop();
        if (!a) return;
        if (a.kind === "move") {
          const it = s.items[a.itemId];
          if (it) {
            it.x = a.after.x;
            it.y = a.after.y;
          }
        } else if (a.kind === "create") {
          s.items[a.item.id] = { ...a.item };
        } else if (a.kind === "delete") {
          delete s.items[a.item.id];
        } else if (a.kind === "patch") {
          const it = s.items[a.itemId];
          if (it) Object.assign(it, a.after);
        }
        s.undoStack.push(a);
      }),
  })),
);

export function selectItemsList(state: CanvasStoreState): CanvasItem[] {
  return Object.values(state.items);
}
