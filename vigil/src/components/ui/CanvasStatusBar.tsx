"use client";

import {
  Cloud,
  CloudSlash,
  DotsThreeOutlineVertical,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/src/components/ui/Button";
import { VIGIL_GLASS_PANEL } from "@/src/lib/vigil-ui-classes";

type SyncMode = "loading" | "local" | "cloud";

export function CanvasStatusBar({
  syncMode,
  camera,
  onOpenSearch,
  menu,
}: {
  syncMode: SyncMode;
  camera: { x: number; y: number; zoom: number };
  onOpenSearch: () => void;
  menu: {
    onNewSpace: () => void;
    onExport: () => void;
    onImport: () => void;
    onToggleScratch: () => void;
  };
}) {
  const [open, setOpen] = useState(false);
  const SyncIcon = syncMode === "cloud" ? Cloud : CloudSlash;
  const syncLabel =
    syncMode === "loading"
      ? "SYNCING"
      : syncMode === "cloud"
        ? "CLOUD"
        : "LOCAL";

  return (
    <div className="pointer-events-none fixed left-6 top-6 z-[800]">
      <div
        className={`pointer-events-auto relative flex items-center gap-2 px-3 py-2 ${VIGIL_GLASS_PANEL}`}
      >
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${syncMode === "loading" ? "animate-pulse bg-amber-400" : "bg-emerald-400"}`}
            aria-hidden
          />
          <span className="font-mono text-[10px] tracking-[0.08em] text-[var(--vigil-label)]">
            {syncLabel}
          </span>
        </div>
        <span className="h-4 w-px bg-[var(--vigil-border)]" aria-hidden />
        <span className="font-mono text-[10px] text-[var(--vigil-muted)]">
          X:{Math.round(camera.x)} Y:{Math.round(camera.y)}
        </span>
        <span className="h-4 w-px bg-[var(--vigil-border)]" aria-hidden />
        <span className="flex items-center gap-1 font-mono text-[10px] text-[var(--vigil-muted)]">
          <SyncIcon size={12} weight="bold" aria-hidden />
          {Math.round(camera.zoom * 100)}%
        </span>
        <Button
          size="icon"
          variant="ghost"
          tone="glass"
          aria-label="Search"
          title="Search"
          onClick={onOpenSearch}
        >
          <MagnifyingGlass size={16} weight="bold" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          tone="glass"
          aria-label="More actions"
          title="More actions"
          onClick={() => setOpen((v) => !v)}
        >
          <DotsThreeOutlineVertical size={16} weight="bold" />
        </Button>
        {open ? (
          <div className="absolute right-1 top-[calc(100%+6px)] min-w-44 rounded-md border border-[var(--vigil-border)] bg-[var(--vigil-elevated)] p-1 shadow-lg">
            <Button
              size="sm"
              variant="subtle"
              tone="menu"
              className="flex w-full justify-start"
              onClick={() => {
                setOpen(false);
                menu.onNewSpace();
              }}
            >
              New space
            </Button>
            <Button
              size="sm"
              variant="subtle"
              tone="menu"
              className="flex w-full justify-start"
              onClick={() => {
                setOpen(false);
                menu.onExport();
              }}
            >
              Export JSON
            </Button>
            <Button
              size="sm"
              variant="subtle"
              tone="menu"
              className="flex w-full justify-start"
              onClick={() => {
                setOpen(false);
                menu.onImport();
              }}
            >
              Import JSON
            </Button>
            <Button
              size="sm"
              variant="subtle"
              tone="menu"
              className="flex w-full justify-start"
              onClick={() => {
                setOpen(false);
                menu.onToggleScratch();
              }}
            >
              Toggle scratch pad
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
