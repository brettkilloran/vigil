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

function randomV11MarkerTrimPx(): string {
  /* Slight right-edge length variance so redactions are not perfectly uniform. */
  const min = 1.5;
  const max = 10.5;
  const px = min + Math.random() * (max - min);
  return `${px.toFixed(2)}px`;
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
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
    if (!el.hasAttribute("data-hg-v11-marker-tilt")) {
      const deg = randomV11MarkerTilt();
      el.setAttribute("data-hg-v11-marker-tilt", deg);
      el.style.setProperty("--sk-v11-marker-rotate", deg);
    }
    if (!el.hasAttribute("data-hg-v11-marker-trim")) {
      const trim = randomV11MarkerTrimPx();
      el.setAttribute("data-hg-v11-marker-trim", trim);
      el.style.setProperty("--sk-v11-marker-trim-right", trim);
    }
    if (!el.hasAttribute("data-hg-v11-marker-trim-top")) {
      const trimTop = `${randomInRange(0.8, 16).toFixed(2)}px`;
      el.setAttribute("data-hg-v11-marker-trim-top", trimTop);
      el.style.setProperty("--sk-v11-marker-trim-right-top", trimTop);
    }
    if (!el.hasAttribute("data-hg-v11-marker-trim-bottom")) {
      const trimBottom = `${randomInRange(1.4, 19).toFixed(2)}px`;
      el.setAttribute("data-hg-v11-marker-trim-bottom", trimBottom);
      el.style.setProperty("--sk-v11-marker-trim-right-bottom", trimBottom);
    }
    if (!el.hasAttribute("data-hg-v11-marker-x")) {
      const shiftX = `${randomInRange(-1.25, 1.25).toFixed(2)}px`;
      el.setAttribute("data-hg-v11-marker-x", shiftX);
      el.style.setProperty("--sk-v11-marker-offset-x", shiftX);
    }
    if (!el.hasAttribute("data-hg-v11-marker-noise")) {
      const noiseSize = `${Math.round(randomInRange(58, 94))}px`;
      el.setAttribute("data-hg-v11-marker-noise", noiseSize);
      el.style.setProperty("--sk-v11-marker-noise-size", noiseSize);
    }
    if (!el.hasAttribute("data-hg-v11-marker-gloss")) {
      const gloss = `${randomInRange(1.7, 4.2).toFixed(2)}%`;
      el.setAttribute("data-hg-v11-marker-gloss", gloss);
      el.style.setProperty("--sk-v11-marker-gloss", gloss);
    }
    if (!el.hasAttribute("data-hg-v11-marker-tail")) {
      const tail = `${randomInRange(91.5, 98.2).toFixed(2)}%`;
      el.setAttribute("data-hg-v11-marker-tail", tail);
      el.style.setProperty("--sk-v11-marker-tail", tail);
    }
  }
}
