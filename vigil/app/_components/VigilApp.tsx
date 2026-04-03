"use client";

import "@/src/types/vigil-shapes";

import {
  createShapeId,
  defaultShapeUtils,
  type Editor,
  Tldraw,
} from "tldraw";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { VigilNoteShapeUtil } from "@/src/canvas/VigilNoteShapeUtil";
import { VigilStickyShapeUtil } from "@/src/canvas/VigilStickyShapeUtil";
import { useSpringBetween } from "@/src/hooks/use-spring-between";
import { parseSpaceIdParam } from "@/src/lib/space-id";
import { VIGIL_UI_SPRING, VIGIL_UI_SPRING_SOFT } from "@/src/lib/spring";

const LS_KEY = "vigil-editor-snapshot";

type SyncMode = "loading" | "local" | "cloud";

type SpaceRow = { id: string; name: string; updatedAt: string };

type BootstrapPayload = {
  spaceId: string | null;
  snapshot: unknown | null;
  spaces: SpaceRow[];
};

function VigilToolbarMounted({
  editor,
  syncMode,
  spaces,
  activeSpaceId,
  onSpaceChange,
  onNewSpace,
}: {
  editor: Editor;
  syncMode: SyncMode;
  spaces: SpaceRow[];
  activeSpaceId: string | null;
  onSpaceChange: (spaceId: string) => void;
  onNewSpace: () => void;
}) {
  const springY = useSpringBetween(0, -14, VIGIL_UI_SPRING);
  const springOpacity = useSpringBetween(1, 0, VIGIL_UI_SPRING_SOFT);
  const addNote = useCallback(() => {
    if (!editor) return;
    editor.createShape({
      id: createShapeId(),
      type: "vigil-note",
      parentId: editor.getCurrentPageId(),
      x: 180 + Math.random() * 48,
      y: 180 + Math.random() * 48,
      props: {
        w: 280,
        h: 180,
        color: "#ffffff",
        text: "",
      },
    });
  }, [editor]);

  const addSticky = useCallback(() => {
    if (!editor) return;
    editor.createShape({
      id: createShapeId(),
      type: "vigil-sticky",
      parentId: editor.getCurrentPageId(),
      x: 220 + Math.random() * 48,
      y: 220 + Math.random() * 48,
      props: {
        w: 200,
        h: 120,
        color: "#00f5a0",
        text: "",
      },
    });
  }, [editor]);

  const modeLabel =
    syncMode === "loading"
      ? "…"
      : syncMode === "cloud"
        ? "Cloud sync"
        : "Local only";

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        transform: `translateY(${springY}px)`,
        opacity: springOpacity,
        willChange: "transform, opacity",
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "#555",
          fontFamily: "system-ui, sans-serif",
          userSelect: "none",
        }}
        title={
          syncMode === "cloud"
            ? "Canvas saves to your database"
            : "Add NEON_DATABASE_URL for cloud sync"
        }
      >
        {modeLabel}
      </span>
      {syncMode === "cloud" && spaces.length > 0 && activeSpaceId ? (
        <>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontFamily: "system-ui, sans-serif",
              color: "#333",
            }}
          >
            <span style={{ userSelect: "none" }}>Space</span>
            <select
              value={activeSpaceId}
              onChange={(e) => onSpaceChange(e.target.value)}
              style={{
                fontSize: 13,
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid #ccc",
                maxWidth: 220,
              }}
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={onNewSpace}>
            New space
          </button>
        </>
      ) : null}
      <button type="button" onClick={addNote}>
        VIGIL note
      </button>
      <button type="button" onClick={addSticky}>
        VIGIL sticky
      </button>
    </div>
  );
}

export default function VigilApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spaceFromUrl = searchParams.get("space");
  const validSpaceParam = parseSpaceIdParam(spaceFromUrl);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [syncMode, setSyncMode] = useState<SyncMode>("loading");
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const spaceIdRef = useRef<string | null>(null);

  const shapeUtils = useMemo(
    () => [...defaultShapeUtils, VigilNoteShapeUtil, VigilStickyShapeUtil],
    [],
  );

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

  useEffect(() => {
    if (!editor) return;

    let cancelled = false;
    let removeListener: (() => void) | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      const qs = validSpaceParam
        ? `?space=${encodeURIComponent(validSpaceParam)}`
        : "";
      const res = await fetch(`/api/bootstrap${qs}`);
      const data = (await res.json()) as BootstrapPayload;

      if (cancelled) return;

      spaceIdRef.current = data.spaceId;
      setActiveSpaceId(data.spaceId);
      setSpaces(data.spaces ?? []);
      setSyncMode(data.spaceId ? "cloud" : "local");

      if (
        data.spaceId &&
        (!spaceFromUrl ||
          !validSpaceParam ||
          validSpaceParam !== data.spaceId)
      ) {
        router.replace(`/?space=${encodeURIComponent(data.spaceId)}`, {
          scroll: false,
        });
      }

      if (data.snapshot) {
        try {
          editor.loadSnapshot(
            data.snapshot as Parameters<Editor["loadSnapshot"]>[0],
          );
        } catch {
          /* ignore corrupt snapshot */
        }
      } else if (data.spaceId) {
        const ids = [...editor.getCurrentPageShapeIds()];
        if (ids.length > 0) editor.deleteShapes(ids);
      } else if (typeof window !== "undefined") {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          try {
            editor.loadSnapshot(JSON.parse(raw) as Parameters<
              Editor["loadSnapshot"]
            >[0]);
          } catch {
            /* ignore */
          }
        }
      }

      const scheduleSave = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          void (async () => {
            const snapshot = editor.getSnapshot();
            const sid = spaceIdRef.current;
            if (!sid) {
              try {
                localStorage.setItem(LS_KEY, JSON.stringify(snapshot));
              } catch {
                /* storage quota */
              }
              return;
            }
            await fetch(`/api/space/${sid}/snapshot`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ snapshot }),
            });
          })();
        }, 900);
      };

      removeListener = editor.store.listen(scheduleSave, {
        source: "user",
        scope: "document",
      });
    })();

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
      removeListener?.();
    };
  }, [editor, validSpaceParam, spaceFromUrl, router]);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {editor ? (
        <VigilToolbarMounted
          editor={editor}
          syncMode={syncMode}
          spaces={spaces}
          activeSpaceId={activeSpaceId}
          onSpaceChange={onSpaceChange}
          onNewSpace={onNewSpace}
        />
      ) : null}
      <Tldraw shapeUtils={shapeUtils} onMount={(ed) => setEditor(ed)} />
    </div>
  );
}
