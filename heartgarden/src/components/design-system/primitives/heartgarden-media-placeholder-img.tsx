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
    // biome-ignore lint/correctness/useImageSize: data-URL design token; intrinsic size handled by CSS aspect-ratio
    // biome-ignore lint/performance/noImgElement: intentional data-URL design token; next/image cannot render data URLs without remotePatterns
    <img
      alt={alt}
      className={[heartgardenMediaPlaceholderClassList(variant), className]
        .filter(Boolean)
        .join(" ")}
      data-hg-heartgarden-media-placeholder="true"
      data-hg-portrait-placeholder="true"
      draggable={false}
      src={HEARTGARDEN_MEDIA_PLACEHOLDER_SRC}
      {...rest}
    />
  );
}
