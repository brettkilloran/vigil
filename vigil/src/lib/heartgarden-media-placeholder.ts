/**
 * Shared SVG data URL for “no image yet” surfaces (media cards, lore portrait wells, etc.).
 * Keep in sync with `HeartgardenMediaPlaceholderImg` / `.placeholder*` styles.
 */
export const HEARTGARDEN_MEDIA_PLACEHOLDER_SRC =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180">
<g opacity="0.5" stroke="rgba(255,255,255,0.09)" stroke-width="0.55" stroke-linecap="square">
<line x1="0" y1="45" x2="240" y2="45"/><line x1="0" y1="90" x2="240" y2="90"/><line x1="0" y1="135" x2="240" y2="135"/>
<line x1="60" y1="0" x2="60" y2="180"/><line x1="120" y1="0" x2="120" y2="180"/><line x1="180" y1="0" x2="180" y2="180"/>
</g>
<g fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter">
<path d="M10 20 L10 8 L22 8"/><path d="M218 8 L230 8 L230 20"/><path d="M10 160 L10 172 L22 172"/><path d="M230 160 L230 172 L218 172"/>
</g>
<g stroke="rgba(255,255,255,0.14)" stroke-width="1" stroke-linecap="square">
<line x1="112" y1="90" x2="128" y2="90"/><line x1="120" y1="82" x2="120" y2="98"/>
</g>
<g opacity="0.55" stroke="rgba(255,255,255,0.08)" stroke-width="0.5" stroke-linecap="square">
<line x1="6" y1="90" x2="16" y2="90"/><line x1="224" y1="90" x2="234" y2="90"/>
<line x1="120" y1="6" x2="120" y2="16"/><line x1="120" y1="164" x2="120" y2="174"/>
</g>
</svg>`,
  );

/** Canonical attribute for placeholder `<img>` (lore still sets `data-hg-portrait-placeholder` for legacy HTML). */
export const HG_MEDIA_PLACEHOLDER_ATTR = "data-hg-heartgarden-media-placeholder";

/** Canonical placeholder surface (standardized across media/lore contexts). */
export type HeartgardenMediaPlaceholderVariant = "neutral";

export function isHeartgardenMediaPlaceholderSrc(src: string | null | undefined): boolean {
  if (!src) return false;
  return src === HEARTGARDEN_MEDIA_PLACEHOLDER_SRC;
}
