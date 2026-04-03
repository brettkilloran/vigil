"use client";

import {
  Cloud,
  CloudSlash,
  DotsThreeOutlineVertical,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { useState } from "react";

import { VIGIL_BTN_ICON, VIGIL_GLASS_PANEL } from "@/src/lib/vigil-ui-classes";

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
        <button
          type="button"
          className={VIGIL_BTN_ICON}
          aria-label="Search"
          title="Search"
          onClick={onOpenSearch}
        >
          <MagnifyingGlass size={16} weight="bold" />
        </button>
        <button
          type="button"
          className={VIGIL_BTN_ICON}
          aria-label="More actions"
          title="More actions"
          onClick={() => setOpen((v) => !v)}
        >
          <DotsThreeOutlineVertical size={16} weight="bold" />
        </button>
        {open ? (
          <div className="absolute right-1 top-[calc(100%+6px)] min-w-44 rounded-md border border-[var(--vigil-border)] bg-[var(--vigil-elevated)] p-1 shadow-lg">
            <button
              type="button"
              className="flex w-full rounded px-2 py-1.5 text-left text-xs text-[var(--foreground)] hover:bg-white/[0.08]"
              onClick={() => {
                setOpen(false);
                menu.onNewSpace();
              }}
            >
              New space
            </button>
            <button
              type="button"
              className="flex w-full rounded px-2 py-1.5 text-left text-xs text-[var(--foreground)] hover:bg-white/[0.08]"
              onClick={() => {
                setOpen(false);
                menu.onExport();
              }}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="flex w-full rounded px-2 py-1.5 text-left text-xs text-[var(--foreground)] hover:bg-white/[0.08]"
              onClick={() => {
                setOpen(false);
                menu.onImport();
              }}
            >
              Import JSON
            </button>
            <button
              type="button"
              className="flex w-full rounded px-2 py-1.5 text-left text-xs text-[var(--foreground)] hover:bg-white/[0.08]"
              onClick={() => {
                setOpen(false);
                menu.onToggleScratch();
              }}
            >
              Toggle scratch pad
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
