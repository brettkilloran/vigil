"use client";

import type { TapeVariant } from "@/src/lib/card-theme";

const tapeClass: Record<TapeVariant, string> = {
  masking:
    "w-[90px] rounded-[1px] border border-black/[0.02] bg-[rgba(240,235,215,0.85)] shadow-[0_1px_3px_rgba(0,0,0,0.05)] backdrop-blur-[2px]",
  clear:
    "w-[70px] rounded-[1px] border border-white/40 bg-white/30 shadow-[0_1px_3px_rgba(0,0,0,0.05)] backdrop-blur-[2px]",
  dark:
    "w-[80px] rounded-[1px] border border-black/50 bg-[rgba(40,40,45,0.9)] shadow-[0_1px_3px_rgba(0,0,0,0.2)] backdrop-blur-[2px]",
};

export function TapeStrip({
  variant,
  rotationDeg,
}: {
  variant: TapeVariant;
  rotationDeg: number;
}) {
  return (
    <div
      className={`pointer-events-none absolute top-[-12px] left-1/2 z-[20] h-7 ${tapeClass[variant]}`}
      style={{
        transform: `translateX(-50%) rotate(${rotationDeg}deg)`,
      }}
      aria-hidden
    />
  );
}
