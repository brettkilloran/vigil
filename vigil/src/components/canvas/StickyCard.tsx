"use client";

import type { CanvasItem } from "@/src/stores/canvas-types";

export function StickyCard({
  item,
  onPersist,
  active,
}: {
  item: CanvasItem;
  onPersist: (patch: { contentText?: string; title?: string }) => void;
  active: boolean;
}) {
  return (
    <textarea
      className="h-full w-full resize-none border-0 bg-transparent px-3 py-2 text-sm leading-snug outline-none"
      style={{
        color: "#111",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      }}
      readOnly={!active}
      value={item.contentText}
      placeholder="Sticky…"
      onChange={(e) => {
        const text = e.target.value;
        const title = text.trim().split(/\n/)[0]?.slice(0, 255) || "Sticky";
        onPersist({ contentText: text, title });
      }}
    />
  );
}
