import styles from "@/src/components/ui/HeartgardenMediaPlaceholderImg.module.css";
import type { HeartgardenMediaPlaceholderVariant } from "@/src/lib/heartgarden-media-placeholder";

/** CSS module class string for seed HTML / `bodyHtml` templates (no React). */
export function heartgardenMediaPlaceholderClassList(
  _variant: HeartgardenMediaPlaceholderVariant
): string {
  void _variant;
  const surface = styles.neutral;
  return `${styles.base} ${surface}`.trim();
}
