"use client";

import type { RefObject } from "react";
import {
  CalendarDots,
  Cloud,
  CloudSlash,
  DownloadSimple,
  FileText,
  FolderPlus,
  Graph,
  ImageSquare,
  LinkSimple,
  ListChecks,
  MagnetStraight,
  MagnifyingGlass,
  Moon,
  NotePencil,
  Notebook,
  UploadSimple,
  Warning,
  X,
} from "@phosphor-icons/react";

import { Button } from "@/src/components/ui/Button";
import type { VigilColorScheme } from "@/src/hooks/use-vigil-theme";
import {
  VIGIL_CHROME_ICON,
  VIGIL_GLASS_PANEL,
  VIGIL_TOOLBAR_DIVIDER,
} from "@/src/lib/vigil-ui-classes";
import type { ItemType } from "@/src/stores/canvas-types";

export type VigilCreateItemKind = Exclude<ItemType, "folder">;

export type VigilSyncMode = "loading" | "local" | "cloud";

export type VigilMainToolbarProps = {
  springY: number;
  syncMode: VigilSyncMode;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  preference: VigilColorScheme;
  onCycleTheme: () => void;
  themeLabel: (p: VigilColorScheme) => string;
  modKeys: { search: string; stack: string };
  spaces: { id: string; name: string; updatedAt: string }[];
  activeSpaceId: string | null;
  onSpaceChange: (id: string) => void;
  onNewSpace: () => void;
  createItemAt: (
    world: { x: number; y: number },
    kind: VigilCreateItemKind,
  ) => void | Promise<void | string | null>;
  onNewFolder: () => void | Promise<void>;
  exportJson: () => void;
  importInputRef: RefObject<HTMLInputElement | null>;
  imagePickInputRef: RefObject<HTMLInputElement | null>;
  scratchPadOpen: boolean;
  onToggleScratch: () => void;
  onOpenSearch: () => void;
  onOpenTimeline: () => void;
  onOpenGraph: () => void;
  uploadMessage: string | null;
  onDismissUpload: () => void;
};

export function VigilMainToolbar({
  springY,
  syncMode,
  snapEnabled,
  onToggleSnap,
  preference,
  onCycleTheme,
  themeLabel,
  modKeys,
  spaces,
  activeSpaceId,
  onSpaceChange,
  onNewSpace,
  createItemAt,
  onNewFolder,
  exportJson,
  importInputRef,
  imagePickInputRef,
  scratchPadOpen,
  onToggleScratch,
  onOpenSearch,
  onOpenTimeline,
  onOpenGraph,
  uploadMessage,
  onDismissUpload,
}: VigilMainToolbarProps) {
  const syncLabel =
    syncMode === "loading"
      ? "…"
      : syncMode === "cloud"
        ? "Cloud sync"
        : "Local only";
  const SyncIcon = syncMode === "cloud" ? Cloud : CloudSlash;

  return (
    <div
      data-vigil-toolbar
      className="pointer-events-none absolute left-3 top-3 z-[800] flex max-w-[min(100vw-24px,920px)] flex-col gap-2"
      style={{ transform: `translateY(${springY}px)` }}
    >
      <div
        className={`pointer-events-auto flex flex-col gap-3 p-3 ${VIGIL_GLASS_PANEL}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--vigil-border)] bg-[var(--vigil-btn-bg)] px-2.5 py-1 text-xs font-medium text-[var(--vigil-label)]"
            title={
              syncMode === "cloud"
                ? "Canvas saves to your database"
                : "Add NEON_DATABASE_URL for cloud sync"
            }
          >
            <SyncIcon className={VIGIL_CHROME_ICON} weight="bold" aria-hidden />
            <span className="select-none">{syncLabel}</span>
          </div>
          <span className={VIGIL_TOOLBAR_DIVIDER} />
          <Button
            size="md"
            variant="neutral"
            tone="glass"
            title="Align items to neighbors when dragging"
            onClick={onToggleSnap}
          >
            <MagnetStraight className={VIGIL_CHROME_ICON} weight="bold" aria-hidden />
            <span>Snap {snapEnabled ? "on" : "off"}</span>
          </Button>
          <Button
            size="md"
            variant="neutral"
            tone="glass"
            title="Color theme"
            onClick={onCycleTheme}
          >
            <Moon className={VIGIL_CHROME_ICON} weight="bold" aria-hidden />
            <span>{themeLabel(preference)}</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--vigil-border)]/60 pt-3">
          {syncMode === "cloud" && spaces.length > 0 && activeSpaceId ? (
            <>
              <label className="flex min-h-9 items-center gap-1.5 text-xs text-[var(--vigil-label)]">
                <span className="select-none shrink-0">Space</span>
                <select
                  className="max-w-[200px] rounded-lg border border-[var(--vigil-border)] bg-[var(--vigil-btn-bg)] px-2 py-1.5 text-[13px] text-[var(--vigil-btn-fg)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vigil-snap)]/40"
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
              <Button size="md" variant="neutral" tone="glass" onClick={onNewSpace}>
                <FolderPlus className={VIGIL_CHROME_ICON} weight="bold" aria-hidden />
                <span>New space</span>
              </Button>
              <span className={VIGIL_TOOLBAR_DIVIDER} />
            </>
          ) : null}

          <Button size="md" variant="neutral" tone="glass" onClick={() => void createItemAt({ x: 120, y: 120 }, "note")}>
            <FileText className={VIGIL_CHROME_ICON} weight="bold" aria-hidden />
            <span>Note</span>
          </Button>
          <Button size="md" variant="neutral" tone="glass" onClick={() => void createItemAt({ x: 160, y: 160 }, "sticky")}>
            <NotePencil className={VIGIL_CHROME_ICON} weight="bold" aria-hidden />
            <span>Sticky</span>
          </Button>
          <Button
            size="md"
            variant="neutral"
            tone="glass"
            title="Standalone checklist card"
            onClick={() => void createItemAt({ x: 200, y: 120 }, "checklist")}
          >
            <ListChecks className={VIGIL_CHROME_ICON} weight="bold" aria-hidden />
            <span>Checklist</span>
          </Button>
          <Button
            size="md"
            variant="neutral"
            tone="glass"
            title="Save a URL with preview"
            onClick={() => void createItemAt({ x: 240, y: 140 }, "webclip")}
          >
            <LinkSimple className={VIGIL_CHROME_ICON} weight="bold" aria-hidden />
            <span>Web clip</span>
          </Button>
          <Button
            size="md"
            variant="neutral"
            tone="glass"
            title="Place an image on the canvas"
            onClick={() => imagePickInputRef.current?.click()}
          >
            <ImageSquare className={VIGIL_CHROME_ICON} weight="bold" aria-hidden />
            <span>Image</span>
          </Button>
          <Button size="md" variant="neutral" tone="glass" onClick={() => void onNewFolder()}>
            <FolderPlus className={VIGIL_CHROME_ICON} weight="bold" aria-hidden />
            <span>Folder</span>
          </Button>

          <span className={VIGIL_TOOLBAR_DIVIDER} />

          <Button size="md" variant="neutral" tone="glass" onClick={exportJson}>
            <DownloadSimple className={VIGIL_CHROME_ICON} weight="bold" aria-hidden />
            <span>Export</span>
          </Button>
          <Button size="md" variant="neutral" tone="glass" onClick={() => importInputRef.current?.click()}>
            <UploadSimple className={VIGIL_CHROME_ICON} weight="bold" aria-hidden />
            <span>Import</span>
          </Button>

          <span className={VIGIL_TOOLBAR_DIVIDER} />

          <Button
            size="md"
            variant="neutral"
            tone="glass"
            isActive={scratchPadOpen}
            onClick={onToggleScratch}
          >
            <Notebook className={VIGIL_CHROME_ICON} weight="bold" aria-hidden />
            <span>Scratch</span>
          </Button>
          <Button size="md" variant="neutral" tone="glass" onClick={onOpenSearch}>
            <MagnifyingGlass className={VIGIL_CHROME_ICON} weight="bold" aria-hidden />
            <span>Search ({modKeys.search})</span>
          </Button>
          <Button
            size="md"
            variant="neutral"
            tone="glass"
            title="Notes tagged Event, sorted by metadata date"
            onClick={onOpenTimeline}
          >
            <CalendarDots className={VIGIL_CHROME_ICON} weight="bold" aria-hidden />
            <span>Timeline</span>
          </Button>
          {syncMode === "cloud" && activeSpaceId ? (
            <Button
              size="md"
              variant="neutral"
              tone="glass"
              title="Items and item_links in this space"
              onClick={onOpenGraph}
            >
              <Graph className={VIGIL_CHROME_ICON} weight="bold" aria-hidden />
              <span>Graph</span>
            </Button>
          ) : null}
        </div>
      </div>

      {uploadMessage ? (
        <div className="pointer-events-auto flex max-w-[min(100vw-24px,640px)] items-start gap-2 rounded-lg border border-amber-600/50 bg-amber-500/15 px-3 py-2 text-[11px] text-amber-950 dark:text-amber-100">
          <Warning
            className="mt-0.5 size-4 shrink-0 opacity-90"
            weight="bold"
            aria-hidden
          />
          <span className="min-w-0 flex-1 leading-snug">{uploadMessage}</span>
          <Button
            size="icon"
            variant="subtle"
            tone="glass"
            className="shrink-0"
            aria-label="Dismiss"
            onClick={onDismissUpload}
          >
            <X className="size-4" weight="bold" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
