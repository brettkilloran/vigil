import type { HeartgardenMediaPlaceholderVariant } from "@/src/lib/heartgarden-media-placeholder";
import styles from "@/src/components/ui/HeartgardenMediaPlaceholderImg.module.css";

/** CSS module class string for seed HTML / `bodyHtml` templates (no React). */
export function heartgardenMediaPlaceholderClassList(
  variant: HeartgardenMediaPlaceholderVariant,
): string {
  const surface =
    variant === "mediaWell"
      ? styles.mediaWell
      : variant === "loreCredential"
        ? styles.loreCredential
        : styles.neutral;
  return `${styles.base} ${surface}`.trim();
}
