"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

import { BacklinksPanel } from "@/src/components/ui/BacklinksPanel";
import { EntityTypeBar } from "@/src/components/canvas/EntityTypeBar";
import { VigilCanvas } from "@/src/components/canvas/VigilCanvas";
import { CommandPalette } from "@/src/components/ui/CommandPalette";
import { LinkGraphOverlay } from "@/src/components/ui/LinkGraphOverlay";
import { TimelinePanel } from "@/src/components/ui/TimelinePanel";
import { ContextMenu } from "@/src/components/ui/ContextMenu";
import { ScratchPad } from "@/src/components/ui/ScratchPad";
import {
  type VigilColorScheme,
  useVigilThemeContext,
} from "@/src/contexts/vigil-theme-context";
import { useSpringBetween } from "@/src/hooks/use-spring-between";
import { parseSpaceIdParam } from "@/src/lib/space-id";
import {
  findNeighborInDirection,
  selectionAnchor,
} from "@/src/lib/spatial-nav";
import { VIGIL_UI_SPRING, VIGIL_UI_SPRING_SOFT } from "@/src/lib/spring";
import { useCanvasStore } from "@/src/stores/canvas-store";
import type { CameraState, CanvasItem } from "@/src/stores/canvas-types";
import { defaultCamera } from "@/src/stores/canvas-types";

const LS_KEY = "vigil-canvas-local-v1";

type BootstrapPayload = {
  ok?: boolean;
  demo?: boolean;
  spaceId: string | null;
  spaces: { id: string; name: string; updatedAt: string }[];
  items: CanvasItem[];
  camera: CameraState;
};

type SyncMode = "loading" | "local" | "cloud";

function themeLabel(p: VigilColorScheme): string {
  if (p === "system") return "Match OS";
  if (p === "light") return "Light";
  return "Dark";
}

function loadLocalState(): {
  camera: CameraState;
  items: CanvasItem[];
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as {
      camera?: CameraState;
      items?: CanvasItem[];
    };
    if (!o.camera || !Array.isArray(o.items)) return null;
    return { camera: o.camera, items: o.items };
  } catch {
    return null;
  }
}

function saveLocalState(camera: CameraState, items: CanvasItem[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ camera, items }));
  } catch {
    /* quota */
  }
}

export default function VigilApp() {
  const { preference, cyclePreference } = useVigilThemeContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const spaceFromUrl = searchParams.get("space");
  const validSpaceParam = parseSpaceIdParam(spaceFromUrl);

  const [syncMode, setSyncMode] = useState<SyncMode>("loading");
  const [spaces, setSpaces] = useState<BootstrapPayload["spaces"]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const cameraTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const itemTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const ctxScreenRef = useRef<{ x: number; y: number } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const uploadMessageTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const showUploadMessage = useCallback((text: string) => {
    clearTimeout(uploadMessageTimer.current);
    setUploadMessage(text);
    uploadMessageTimer.current = setTimeout(() => setUploadMessage(null), 10_000);
  }, []);

  const hydrate = useCanvasStore((s) => s.hydrate);
  const reset = useCanvasStore((s) => s.reset);
  const camera = useCanvasStore((s) => s.camera);
  const putItem = useCanvasStore((s) => s.putItem);
  const patchItemLocal = useCanvasStore((s) => s.patchItemLocal);
  const removeItemLocal = useCanvasStore((s) => s.removeItemLocal);
  const snapEnabled = useCanvasStore((s) => s.snapEnabled);
  const setSnapEnabled = useCanvasStore((s) => s.setSnapEnabled);
  const scratchPadOpen = useCanvasStore((s) => s.scratchPadOpen);
  const setScratchPadOpen = useCanvasStore((s) => s.setScratchPadOpen);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  const itemsRecord = useCanvasStore((s) => s.items);

  const springY = useSpringBetween(0, -14, VIGIL_UI_SPRING);
  const springOpacity = useSpringBetween(1, 0, VIGIL_UI_SPRING_SOFT);

  const scheduleCameraPersist = useCallback(
    (spaceId: string, cam: CameraState) => {
      clearTimeout(cameraTimer.current);
      cameraTimer.current = setTimeout(() => {
        void fetch(`/api/spaces/${spaceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ camera: cam }),
        });
      }, 500);
    },
    [],
  );

  const scheduleItemPersist = useCallback((id: string, patch: object) => {
    const prev = itemTimers.current.get(id);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      itemTimers.current.delete(id);
      void fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    }, 450);
    itemTimers.current.set(id, t);
  }, []);

  const onPatchItem = useCallback(
    (id: string, patch: Partial<CanvasItem>) => {
      patchItemLocal(id, patch);
      const sid = useCanvasStore.getState().spaceId;
      if (!sid) {
        saveLocalState(useCanvasStore.getState().camera, Object.values(useCanvasStore.getState().items));
        return;
      }
      scheduleItemPersist(id, patch);
    },
    [patchItemLocal, scheduleItemPersist],
  );

  const focusItemOnCanvas = useCallback((id: string) => {
    const st = useCanvasStore.getState();
    const it = st.items[id];
    if (!it) return;
    const z = st.camera.zoom;
    st.setCamera({
      x: window.innerWidth / 2 - (it.x + it.width / 2) * z,
      y: window.innerHeight / 2 - (it.y + it.height / 2) * z,
      zoom: z,
    });
    st.selectOnly(id);
  }, []);

  useEffect(() => {
    const sid = useCanvasStore.getState().spaceId;
    if (syncMode !== "cloud" || !sid) return;
    scheduleCameraPersist(sid, camera);
  }, [camera, scheduleCameraPersist, syncMode]);

  useEffect(() => {
    return () => clearTimeout(uploadMessageTimer.current);
  }, []);

  useEffect(() => {
    if (syncMode !== "local") return;
    saveLocalState(camera, Object.values(itemsRecord));
  }, [camera, itemsRecord, syncMode]);

  useEffect(() => {
    let cancelled = false;
    reset();
    const qs = validSpaceParam
      ? `?space=${encodeURIComponent(validSpaceParam)}`
      : "";

    void (async () => {
      const res = await fetch(`/api/bootstrap${qs}`);
      const data = (await res.json()) as BootstrapPayload;
      if (cancelled) return;

      if (data.demo) {
        const local = loadLocalState();
        const cam = local?.camera ?? defaultCamera();
        const items = local?.items ?? [];
        setActiveSpaceId(null);
        setSpaces([]);
        setSyncMode("local");
        hydrate({
          spaceId: null,
          items,
          camera: cam,
        });
        return;
      }

      const sid = data.spaceId;
      setSpaces(data.spaces ?? []);
      setActiveSpaceId(sid);
      setSyncMode("cloud");
      hydrate({
        spaceId: sid,
        items: data.items ?? [],
        camera: data.camera ?? defaultCamera(),
      });

      if (
        sid &&
        (!spaceFromUrl || !validSpaceParam || validSpaceParam !== sid)
      ) {
        router.replace(`/?space=${encodeURIComponent(sid)}`, { scroll: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrate, reset, router, spaceFromUrl, validSpaceParam]);

  const onSpaceChange = useCallback(
    (id: string) => {
      router.replace(`/?space=${encodeURIComponent(id)}`, { scroll: false });
    },
    [router],
  );

  const onNewSpace = useCallback(() => {
    const name = window.prompt("Name for the new space", "New space");
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    void (async () => {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        space?: { id: string };
      };
      if (data.ok && data.space?.id) {
        router.push(`/?space=${encodeURIComponent(data.space.id)}`);
      }
    })();
  }, [router]);

  const createItemAt = useCallback(
    async (
      world: { x: number; y: number },
      kind: "note" | "sticky",
    ): Promise<string | null> => {
      const sid = useCanvasStore.getState().spaceId;
      const w = kind === "note" ? 280 : 200;
      const h = kind === "note" ? 200 : 140;
      const x = world.x - w / 2;
      const y = world.y - h / 2;

      if (!sid) {
        const item: CanvasItem = {
          id: crypto.randomUUID(),
          spaceId: "local",
          itemType: kind,
          x,
          y,
          width: w,
          height: h,
          zIndex: Object.keys(useCanvasStore.getState().items).length,
          title: kind === "note" ? "Note" : "Sticky",
          contentText: "",
          color: kind === "sticky" ? "#00f5a0" : "#ffffff",
        };
        putItem(item);
        pushUndo({ kind: "create", item: { ...item } });
        return item.id;
      }

      const res = await fetch(`/api/spaces/${sid}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType: kind,
          x,
          y,
          width: w,
          height: h,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; item?: CanvasItem };
      if (data.ok && data.item) {
        putItem(data.item);
        pushUndo({ kind: "create", item: { ...data.item } });
        return data.item.id;
      }
      return null;
    },
    [putItem, pushUndo],
  );

  const onOpenFolder = useCallback(
    (childSpaceId: string) => {
      router.push(`/?space=${encodeURIComponent(childSpaceId)}`);
    },
    [router],
  );

  const exportJson = useCallback(() => {
    const payload = {
      camera: useCanvasStore.getState().camera,
      items: Object.values(useCanvasStore.getState().items),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vigil-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const setCameraStore = useCanvasStore((s) => s.setCamera);

  const onImportJsonFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        window.alert("Invalid JSON file.");
        return;
      }
      const o = parsed as { items?: unknown; camera?: unknown };
      if (!Array.isArray(o.items)) {
        window.alert('JSON must contain an "items" array.');
        return;
      }
      const rawCam = o.camera;
      const cam: CameraState =
        rawCam &&
        typeof rawCam === "object" &&
        typeof (rawCam as CameraState).x === "number" &&
        typeof (rawCam as CameraState).y === "number" &&
        typeof (rawCam as CameraState).zoom === "number"
          ? (rawCam as CameraState)
          : defaultCamera();

      const sid = useCanvasStore.getState().spaceId;
      const rows = o.items as CanvasItem[];

      if (!sid) {
        const normalized = rows.map((it, i) => ({
          ...it,
          id:
            typeof it.id === "string" && it.id.length > 10
              ? it.id
              : crypto.randomUUID(),
          spaceId: "local" as const,
          zIndex: typeof it.zIndex === "number" ? it.zIndex : i,
        }));
        hydrate({ spaceId: null, items: normalized, camera: cam });
        saveLocalState(cam, normalized);
        window.alert(`Imported ${normalized.length} items (local).`);
        return;
      }

      if (
        !window.confirm(
          `Import ${rows.length} items as new rows in this space? vigil:item links in notes may point at old UUIDs unless this file came from the same database.`,
        )
      ) {
        return;
      }

      let n = 0;
      for (const raw of rows) {
        const body: Record<string, unknown> = {
          itemType: raw.itemType,
          x: raw.x,
          y: raw.y,
          width: raw.width,
          height: raw.height,
          title: raw.title ?? "Item",
          contentText: raw.contentText ?? "",
          contentJson: raw.contentJson ?? undefined,
          color: raw.color ?? undefined,
          entityType: raw.entityType ?? undefined,
          entityMeta: raw.entityMeta ?? undefined,
        };
        const iu = raw.imageUrl;
        if (typeof iu === "string" && iu.length > 0 && !iu.startsWith("blob:")) {
          body.imageUrl = iu;
        }
        const res = await fetch(`/api/spaces/${sid}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { ok?: boolean; item?: CanvasItem };
        if (data.ok && data.item) {
          putItem(data.item);
          n++;
        }
      }
      await fetch(`/api/spaces/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camera: cam }),
      });
      setCameraStore(cam);
      window.alert(`Imported ${n} items.`);
    },
    [hydrate, putItem, setCameraStore],
  );

  const stackSelection = useCallback(async () => {
    const ids = useCanvasStore.getState().selectedIds;
    if (ids.length < 2) return;
    const stackId = crypto.randomUUID();
    const sid = useCanvasStore.getState().spaceId;
    ids.forEach((id, i) => {
      patchItemLocal(id, { stackId, stackOrder: i });
      if (sid) scheduleItemPersist(id, { stackId, stackOrder: i });
    });
    if (!sid) {
      saveLocalState(useCanvasStore.getState().camera, Object.values(useCanvasStore.getState().items));
    }
  }, [patchItemLocal, scheduleItemPersist]);

  const newFolderSpace = useCallback(async () => {
    const sid = useCanvasStore.getState().spaceId;
    const name = window.prompt("Folder name", "Folder");
    if (name === null || !name.trim()) return;
    if (!sid) {
      window.alert("Folders need cloud sync (Neon).");
      return;
    }
    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), parentSpaceId: sid }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      space?: { id: string };
    };
    if (!data.ok || !data.space?.id) return;
    const childId = data.space.id;
    const w = 220;
    const h = 160;
    const cam = useCanvasStore.getState().camera;
    const cx = (-cam.x + window.innerWidth / 2) / cam.zoom;
    const cy = (-cam.y + window.innerHeight / 2) / cam.zoom;
    const resItem = await fetch(`/api/spaces/${sid}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemType: "folder",
        x: cx - w / 2,
        y: cy - h / 2,
        width: w,
        height: h,
        title: name.trim(),
        entityMeta: { childSpaceId: childId },
      }),
    });
    const itemData = (await resItem.json()) as {
      ok?: boolean;
      item?: CanvasItem;
    };
    if (itemData.ok && itemData.item) putItem(itemData.item);
  }, [putItem]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.closest?.("[data-vigil-palette]")) return;
      if (t?.isContentEditable || t?.tagName === "INPUT" || t?.tagName === "TEXTAREA") {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          setPaletteOpen(true);
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void stackSelection();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const ids = [...useCanvasStore.getState().selectedIds];
        if (ids.length === 0) return;
        e.preventDefault();
        const sid = useCanvasStore.getState().spaceId;
        for (const id of ids) {
          const it = useCanvasStore.getState().items[id];
          if (it) pushUndo({ kind: "delete", item: { ...it } });
          removeItemLocal(id);
          if (sid) void fetch(`/api/items/${id}`, { method: "DELETE" });
        }
        if (!sid) {
          saveLocalState(useCanvasStore.getState().camera, Object.values(useCanvasStore.getState().items));
        }
      }

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const dir =
          e.key === "ArrowLeft"
            ? "left"
            : e.key === "ArrowRight"
              ? "right"
              : e.key === "ArrowUp"
                ? "up"
                : "down";

        const st0 = useCanvasStore.getState();
        const ids = st0.selectedIds;
        const allItems = Object.values(st0.items);

        if (e.altKey && e.shiftKey) {
          e.preventDefault();
          let from: { x: number; y: number } | null = null;
          const exclude = new Set(ids);

          if (ids.length > 0) {
            const selected = ids
              .map((id) => st0.items[id])
              .filter(Boolean) as CanvasItem[];
            from = selectionAnchor(selected);
          } else {
            const cam = st0.camera;
            from = {
              x: (-cam.x + window.innerWidth / 2) / cam.zoom,
              y: (-cam.y + window.innerHeight / 2) / cam.zoom,
            };
          }
          if (!from) return;

          const next = findNeighborInDirection(from, dir, allItems, exclude);
          if (!next) return;

          const z = st0.camera.zoom;
          useCanvasStore.getState().setCamera({
            x: window.innerWidth / 2 - (next.x + next.width / 2) * z,
            y: window.innerHeight / 2 - (next.y + next.height / 2) * z,
            zoom: z,
          });
          useCanvasStore.getState().selectOnly(next.id);
          return;
        }

        if (ids.length !== 1) return;
        const id = ids[0]!;
        const it = st0.items[id];
        if (!it) return;
        e.preventDefault();
        const step = e.shiftKey ? 40 : 8;
        const dx = dir === "left" ? -step : dir === "right" ? step : 0;
        const dy = dir === "up" ? -step : dir === "down" ? step : 0;
        const nx = it.x + dx;
        const ny = it.y + dy;
        patchItemLocal(id, { x: nx, y: ny });
        if (useCanvasStore.getState().spaceId) {
          scheduleItemPersist(id, { x: nx, y: ny });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [patchItemLocal, pushUndo, redo, removeItemLocal, scheduleItemPersist, stackSelection, undo]);

  const onToggleSnap = useCallback(() => {
    setSnapEnabled(!useCanvasStore.getState().snapEnabled);
  }, [setSnapEnabled]);

  return (
    <div
      className="relative h-dvh w-dvw"
      onContextMenu={(e) => {
        e.preventDefault();
        ctxScreenRef.current = { x: e.clientX, y: e.clientY };
        setCtxMenu({ x: e.clientX, y: e.clientY });
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const files = [...e.dataTransfer.files];
        const img = files.find((f) => f.type.startsWith("image/"));
        if (!img) return;
        const sid = useCanvasStore.getState().spaceId;
        const w = 320;
        const h = 240;
        const cam = useCanvasStore.getState().camera;
        const wx = (-cam.x + e.clientX) / cam.zoom - w / 2;
        const wy = (-cam.y + e.clientY) / cam.zoom - h / 2;
        const zNext = Object.keys(useCanvasStore.getState().items).length + 1;
        const title = img.name.slice(0, 255) || "Image";
        const contentType = img.type || "application/octet-stream";

        const putLocalPreview = () => {
          const url = URL.createObjectURL(img);
          const item: CanvasItem = {
            id: crypto.randomUUID(),
            spaceId: sid ?? "local",
            itemType: "image",
            x: wx,
            y: wy,
            width: w,
            height: h,
            zIndex: zNext,
            title,
            contentText: "",
            imageUrl: url,
            imageMeta: { filename: img.name, localPreview: true },
          };
          putItem(item);
        };

        if (!sid) {
          putLocalPreview();
          return;
        }

        void (async () => {
          const pres = await fetch("/api/upload/presign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contentType,
              filename: img.name,
              spaceId: sid,
            }),
          });
          const presData = (await pres.json()) as {
            ok?: boolean;
            uploadUrl?: string;
            publicUrl?: string;
            key?: string;
            error?: string;
          };

          if (!pres.ok || !presData.ok || !presData.uploadUrl || !presData.publicUrl) {
            showUploadMessage(
              presData.error ??
                `Could not prepare image upload (HTTP ${pres.status}). Dropped a local-only preview — it will not sync or survive refresh.`,
            );
            putLocalPreview();
            return;
          }

          const putRes = await fetch(presData.uploadUrl, {
            method: "PUT",
            body: img,
            headers: { "Content-Type": contentType },
          });
          if (!putRes.ok) {
            showUploadMessage(
              `Upload to R2 failed (${putRes.status}). Dropped a local-only preview instead.`,
            );
            putLocalPreview();
            return;
          }

          clearTimeout(uploadMessageTimer.current);
          setUploadMessage(null);

          const res = await fetch(`/api/spaces/${sid}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itemType: "image",
              x: wx,
              y: wy,
              width: w,
              height: h,
              title,
              imageUrl: presData.publicUrl,
              imageMeta: { filename: img.name, key: presData.key },
            }),
          });
          const data = (await res.json()) as { ok?: boolean; item?: CanvasItem };
          if (data.ok && data.item) putItem(data.item);
          else
            showUploadMessage(
              (data as { error?: string }).error ??
                "Image uploaded but creating the canvas item failed.",
            );
        })();
      }}
    >
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-hidden
        onChange={onImportJsonFile}
      />

      <VigilCanvas
        onPatchItem={onPatchItem}
        onCreateItemAt={createItemAt}
        onOpenFolder={onOpenFolder}
      />

      <EntityTypeBar onPatchItem={onPatchItem} />

      <BacklinksPanel cloudMode={syncMode === "cloud"} />

      <div
        className="pointer-events-none absolute left-3 top-3 z-[800] flex max-w-[min(100vw-24px,920px)] flex-col gap-2"
        style={{
          transform: `translateY(${springY}px)`,
          opacity: springOpacity,
        }}
      >
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <span
            className="select-none text-xs text-[var(--vigil-muted)]"
            title={
              syncMode === "cloud"
                ? "Canvas saves to your database"
                : "Add NEON_DATABASE_URL for cloud sync"
            }
          >
            {syncMode === "loading"
              ? "…"
              : syncMode === "cloud"
                ? "Cloud sync"
                : "Local only"}
          </span>
          <button
            type="button"
            className="rounded-md border border-[var(--vigil-btn-border)] bg-[var(--vigil-btn-bg)] px-2.5 py-1 text-xs text-[var(--vigil-btn-fg)]"
            onClick={onToggleSnap}
          >
            Snap: {snapEnabled ? "on" : "off"}
          </button>
          <button
            type="button"
            className="rounded-md border border-[var(--vigil-btn-border)] bg-[var(--vigil-btn-bg)] px-2.5 py-1 text-xs text-[var(--vigil-btn-fg)]"
            onClick={cyclePreference}
          >
            Theme: {themeLabel(preference)}
          </button>
        </div>
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          {syncMode === "cloud" && spaces.length > 0 && activeSpaceId ? (
            <>
              <label className="flex items-center gap-1.5 text-xs text-[var(--vigil-label)]">
                <span className="select-none">Space</span>
                <select
                  className="max-w-[220px] rounded-md border border-[var(--vigil-border)] bg-[var(--vigil-btn-bg)] px-2 py-1 text-[13px] text-[var(--vigil-btn-fg)]"
                  value={activeSpaceId}
                  onChange={(e) => onSpaceChange(e.target.value)}
                >
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="rounded-md border border-[var(--vigil-btn-border)] bg-[var(--vigil-btn-bg)] px-2.5 py-1 text-xs text-[var(--vigil-btn-fg)]"
                onClick={onNewSpace}
              >
                New space
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="rounded-md border border-[var(--vigil-btn-border)] bg-[var(--vigil-btn-bg)] px-2.5 py-1 text-xs text-[var(--vigil-btn-fg)]"
            onClick={() => void createItemAt({ x: 120, y: 120 }, "note")}
          >
            Note
          </button>
          <button
            type="button"
            className="rounded-md border border-[var(--vigil-btn-border)] bg-[var(--vigil-btn-bg)] px-2.5 py-1 text-xs text-[var(--vigil-btn-fg)]"
            onClick={() => void createItemAt({ x: 160, y: 160 }, "sticky")}
          >
            Sticky
          </button>
          <button
            type="button"
            className="rounded-md border border-[var(--vigil-btn-border)] bg-[var(--vigil-btn-bg)] px-2.5 py-1 text-xs text-[var(--vigil-btn-fg)]"
            onClick={() => void newFolderSpace()}
          >
            Folder
          </button>
          <button
            type="button"
            className="rounded-md border border-[var(--vigil-btn-border)] bg-[var(--vigil-btn-bg)] px-2.5 py-1 text-xs text-[var(--vigil-btn-fg)]"
            onClick={exportJson}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="rounded-md border border-[var(--vigil-btn-border)] bg-[var(--vigil-btn-bg)] px-2.5 py-1 text-xs text-[var(--vigil-btn-fg)]"
            onClick={() => importInputRef.current?.click()}
          >
            Import JSON
          </button>
          <button
            type="button"
            className="rounded-md border border-[var(--vigil-btn-border)] bg-[var(--vigil-btn-bg)] px-2.5 py-1 text-xs text-[var(--vigil-btn-fg)]"
            onClick={() => setScratchPadOpen(!scratchPadOpen)}
          >
            Scratch
          </button>
          <button
            type="button"
            className="rounded-md border border-[var(--vigil-btn-border)] bg-[var(--vigil-btn-bg)] px-2.5 py-1 text-xs text-[var(--vigil-btn-fg)]"
            onClick={() => setPaletteOpen(true)}
          >
            Search (⌘K)
          </button>
          <button
            type="button"
            className="rounded-md border border-[var(--vigil-btn-border)] bg-[var(--vigil-btn-bg)] px-2.5 py-1 text-xs text-[var(--vigil-btn-fg)]"
            title="Notes tagged Event, sorted by metadata date"
            onClick={() => setTimelineOpen(true)}
          >
            Timeline
          </button>
          {syncMode === "cloud" && activeSpaceId ? (
            <button
              type="button"
              className="rounded-md border border-[var(--vigil-btn-border)] bg-[var(--vigil-btn-bg)] px-2.5 py-1 text-xs text-[var(--vigil-btn-fg)]"
              title="Items and item_links in this space"
              onClick={() => setGraphOpen(true)}
            >
              Graph
            </button>
          ) : null}
        </div>
        {uploadMessage ? (
          <div className="pointer-events-auto flex max-w-[min(100vw-24px,640px)] items-start gap-2 rounded-md border border-amber-600/50 bg-amber-500/15 px-2.5 py-1.5 text-[11px] text-amber-950 dark:text-amber-100">
            <span className="min-w-0 flex-1 leading-snug">{uploadMessage}</span>
            <button
              type="button"
              className="shrink-0 rounded px-1.5 py-0.5 hover:bg-black/10 dark:hover:bg-white/10"
              onClick={() => {
                clearTimeout(uploadMessageTimer.current);
                setUploadMessage(null);
              }}
            >
              Dismiss
            </button>
          </div>
        ) : null}
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        spaceId={activeSpaceId}
        onExportJson={exportJson}
        onSelectItem={focusItemOnCanvas}
      />

      <LinkGraphOverlay
        open={graphOpen}
        spaceId={activeSpaceId}
        onClose={() => setGraphOpen(false)}
        onSelectItem={focusItemOnCanvas}
      />
      <TimelinePanel
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        onSelectItem={focusItemOnCanvas}
      />

      <ScratchPad
        open={scratchPadOpen}
        onClose={() => setScratchPadOpen(false)}
        onSubmit={(text) => {
          void (async () => {
            const id = await createItemAt({ x: 200, y: 200 }, "note");
            if (!id) return;
            const title = text.trim().split(/\n/)[0]?.slice(0, 255) || "Note";
            patchItemLocal(id, { contentText: text, title });
            const sid = useCanvasStore.getState().spaceId;
            if (sid) scheduleItemPersist(id, { contentText: text, title });
            else {
              saveLocalState(
                useCanvasStore.getState().camera,
                Object.values(useCanvasStore.getState().items),
              );
            }
          })();
        }}
      />

      <ContextMenu
        position={ctxMenu}
        onClose={() => setCtxMenu(null)}
        items={[
          {
            label: "New note here",
            onSelect: () => {
              const p = ctxScreenRef.current;
              if (!p) return;
              const cam = useCanvasStore.getState().camera;
              const wx = (-cam.x + p.x) / cam.zoom;
              const wy = (-cam.y + p.y) / cam.zoom;
              void createItemAt({ x: wx, y: wy }, "note");
            },
          },
          {
            label: "Stack selection (⌘S)",
            onSelect: () => void stackSelection(),
          },
        ]}
      />
    </div>
  );
}
