/**
 * v11 guest-check redaction strokes: each field gets a one-time random slight rotation so
 * markers feel hand-drawn rather than identical. Sets `--sk-v11-marker-rotate` on the host
 * (inherited by `::after`); see `lore-entity-card.module.css` `.charSkShellV11`.
 */

function randomV11MarkerTilt(): string {
  /* ~±0.32° jitter around -0.52° — always a faint CCW lean, never harsh. */
  const base = -0.52;
  const spread = 0.32;
  const r = base + (Math.random() * 2 - 1) * spread;
  return `${r.toFixed(3)}deg`;
}

/**
 * Assigns a stable random `--sk-v11-marker-rotate` on each redacted inline field under a v11 shell.
 * Skips notes + header catalog line. Idempotent via `data-hg-v11-marker-tilt`.
 */
export function syncLoreV11MarkerTilts(host: HTMLElement | null): void {
  if (!host || typeof document === "undefined") return;
  const shell = host.querySelector<HTMLElement>('[class*="charSkShellV11"]');
  if (!shell) return;

  for (const el of shell.querySelectorAll<HTMLElement>("[data-hg-lore-field]")) {
    if (el.matches?.('[class*="charSkNotesBody"]') || el.matches?.('[class*="charSkHeaderMeta"]')) {
      continue;
    }
    if (el.hasAttribute("data-hg-v11-marker-tilt")) continue;
    const deg = randomV11MarkerTilt();
    el.setAttribute("data-hg-v11-marker-tilt", deg);
    el.style.setProperty("--sk-v11-marker-rotate", deg);
  }
}
