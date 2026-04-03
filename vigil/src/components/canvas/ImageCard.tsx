"use client";

import { useEffect, useRef } from "react";

import { extractImagePalette } from "@/src/lib/extract-image-palette";
import { VIGIL_METADATA_LABEL } from "@/src/lib/vigil-ui-classes";
import type { CanvasItem } from "@/src/stores/canvas-types";

type ImageMeta = { palette?: string[]; filename?: string; localPreview?: boolean };

export function ImageCard({
  item,
  active,
  onPatchItem,
}: {
  item: CanvasItem;
  active: boolean;
  onPatchItem: (id: string, patch: Partial<CanvasItem>) => void;
}) {
  const paletteDone = useRef(false);
  useEffect(() => {
    paletteDone.current = false;
  }, [item.id, item.imageUrl]);

  useEffect(() => {
    if (!item.imageUrl || paletteDone.current) return;
    const meta = (item.imageMeta ?? {}) as ImageMeta;
    if (Array.isArray(meta.palette) && meta.palette.length > 0) {
      paletteDone.current = true;
      return;
    }
    let cancelled = false;
    void extractImagePalette(item.imageUrl).then((palette) => {
      if (cancelled || palette.length === 0) return;
      paletteDone.current = true;
      onPatchItem(item.id, {
        imageMeta: { ...meta, palette },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [item.id, item.imageUrl, item.imageMeta, onPatchItem]);

  if (!item.imageUrl) {
    return (
      <div className="flex h-full items-center justify-center p-2 text-xs text-[var(--vigil-muted)]">
        No image URL
      </div>
    );
  }

  const palette = (item.imageMeta as ImageMeta | null)?.palette ?? [];

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* eslint-disable-next-line @next/next/no-img-element -- blob/object URLs */}
      <img
        src={item.imageUrl}
        alt={item.title}
        className="min-h-0 flex-1 w-full object-cover"
        draggable={false}
        loading="lazy"
        decoding="async"
      />
      {active && palette.length > 0 ? (
        <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 border-t border-black/10 bg-[var(--vigil-card-bg)]/92 px-2 py-1.5 backdrop-blur-sm dark:border-white/10">
          <span className={`shrink-0 ${VIGIL_METADATA_LABEL}`}>Palette</span>
          <div className="flex flex-wrap gap-1">
            {palette.map((hex) => (
              <span
                key={hex}
                className="h-5 w-5 shrink-0 rounded-full border border-black/15 shadow-sm dark:border-white/20"
                style={{ backgroundColor: hex }}
                title={hex}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
