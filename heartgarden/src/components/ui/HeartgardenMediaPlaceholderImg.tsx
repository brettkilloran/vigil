"use client";

import type { ImgHTMLAttributes } from "react";

import type { HeartgardenMediaPlaceholderVariant } from "@/src/lib/heartgarden-media-placeholder";
import { HEARTGARDEN_MEDIA_PLACEHOLDER_SRC } from "@/src/lib/heartgarden-media-placeholder";
import { heartgardenMediaPlaceholderClassList } from "@/src/lib/heartgarden-media-placeholder-classes";

export type { HeartgardenMediaPlaceholderVariant } from "@/src/lib/heartgarden-media-placeholder";

/** Design-system empty image: same SVG grid + standardized neutral placeholder surface. */
export function HeartgardenMediaPlaceholderImg({
  variant = "neutral",
  className,
  alt = "",
  ...rest
}: {
  variant?: HeartgardenMediaPlaceholderVariant;
  className?: string;
  alt?: string;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- intentional data-URL design token
    <img
      src={HEARTGARDEN_MEDIA_PLACEHOLDER_SRC}
      alt={alt}
      draggable={false}
      data-hg-heartgarden-media-placeholder="true"
      data-hg-portrait-placeholder="true"
      className={[heartgardenMediaPlaceholderClassList(variant), className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}
