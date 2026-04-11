/**
 * v11 guest-check redaction strokes: per-field deterministic jitter so cards keep their
 * distinct look across rerenders/interactions instead of "changing shape" after focus/edit.
 * Values are written as CSS vars consumed by `lore-entity-card.module.css` `.charSkShellV11`.
 */

const seededV11Shells = new WeakSet<HTMLElement>();

function fnv1aHash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function seededFloat(seed: string, key: string, min: number, max: number): number {
  const n = fnv1aHash32(`${seed}:${key}`);
  const t = n / 0xffffffff;
  return min + (max - min) * t;
}

/**
 * Assigns per-field marker jitter vars once per mounted v11 shell.
 * Skips notes + header catalog line. Uses WeakSet idempotence so stale serialized attrs/styles
 * from saved HTML never freeze all strokes into one repeated look.
 */
export function syncLoreV11MarkerTilts(host: HTMLElement | null): void {
  if (!host || typeof document === "undefined") return;
  const shell = host.matches?.('[class*="charSkShellV11"]')
    ? host
    : host.querySelector<HTMLElement>('[class*="charSkShellV11"]');
  if (!shell) return;
  if (seededV11Shells.has(shell)) return;
  seededV11Shells.add(shell);

  const headerMeta = shell.querySelector<HTMLElement>('[class*="charSkHeaderMeta"]');
  const shellSeed =
    headerMeta?.getAttribute("data-hg-object-id-full")?.trim() ||
    headerMeta?.textContent?.trim() ||
    "v11-shell";

  let fieldIndex = 0;
  for (const el of shell.querySelectorAll<HTMLElement>("[data-hg-lore-field]")) {
    if (el.matches?.('[class*="charSkNotesBody"]') || el.matches?.('[class*="charSkHeaderMeta"]')) {
      continue;
    }

    const fieldSeed = `${shellSeed}|${fieldIndex}|${el.getAttribute("data-hg-lore-ph") ?? ""}|${el.className}`;
    fieldIndex += 1;

    const deg = `${seededFloat(fieldSeed, "rotate", -0.84, -0.2).toFixed(3)}deg`;
    const trim = `${seededFloat(fieldSeed, "trim", 1.5, 10.5).toFixed(2)}px`;
    const trimTop = `${seededFloat(fieldSeed, "trim-top", 0.8, 16).toFixed(2)}px`;
    const trimBottom = `${seededFloat(fieldSeed, "trim-bottom", 1.4, 19).toFixed(2)}px`;
    const shiftX = `${seededFloat(fieldSeed, "offset-x", -1.25, 1.25).toFixed(2)}px`;
    const gloss = `${seededFloat(fieldSeed, "gloss", 0.55, 1.8).toFixed(2)}%`;
    const tail = `${seededFloat(fieldSeed, "tail", 91.5, 98.2).toFixed(2)}%`;

    el.style.setProperty("--sk-v11-marker-rotate", deg);
    el.style.setProperty("--sk-v11-marker-trim-right", trim);
    el.style.setProperty("--sk-v11-marker-trim-right-top", trimTop);
    el.style.setProperty("--sk-v11-marker-trim-right-bottom", trimBottom);
    el.style.setProperty("--sk-v11-marker-offset-x", shiftX);
    el.style.setProperty("--sk-v11-marker-gloss", gloss);
    el.style.setProperty("--sk-v11-marker-tail", tail);
  }
}
