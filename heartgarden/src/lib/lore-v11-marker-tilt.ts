/**
 * v11 guest-check redaction strokes: per-field deterministic jitter so cards keep their
 * distinct look across rerenders/interactions instead of "changing shape" after focus/edit.
 * Values are written as CSS vars consumed by `lore-entity-card.module.css` (`.charSkShellV11`,
 * `.locOrdoV7Root`). Dual-line placename strips stagger via `--sk-v11-marker-trim-right-top` /
 * `--sk-v11-marker-trim-right-bottom`; `skewY` + wide `rotate` ranges keep the two bars from
 * reading as identical machine strokes.
 */

/** Per `[data-hg-lore-field]` node — *not* the card root. Root-level idempotence breaks React remounts
 * (new h1 loses inline vars while the root stayed in a WeakSet → dual strips fall back to identical defaults). */
const seededMarkerFieldElements = new WeakSet<HTMLElement>();

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

function applyMarkerTiltVars(el: HTMLElement, fieldSeed: string): void {
  const rotate = seededFloat(fieldSeed, "rotate", -2.55, 2.35);
  const deg = `${rotate.toFixed(3)}deg`;

  const trim = `${seededFloat(fieldSeed, "trim", 2, 22).toFixed(2)}px`;

  const trimTop = seededFloat(fieldSeed, "trim-top", 0, 28);
  let trimBottom = seededFloat(fieldSeed, "trim-bottom", 0, 36);
  if (Math.abs(trimTop - trimBottom) < 10) {
    trimBottom = Math.min(trimTop + 10 + seededFloat(fieldSeed, "trim-uniformity", 0, 22), 52);
  }

  const shiftX = `${seededFloat(fieldSeed, "offset-x", -3.75, 3.75).toFixed(2)}px`;
  const skewY = `${seededFloat(fieldSeed, "skew-y", -0.72, 0.84).toFixed(3)}deg`;
  const gloss = `${seededFloat(fieldSeed, "gloss", 0.4, 2.35).toFixed(2)}%`;
  const tail = `${seededFloat(fieldSeed, "tail", 82.5, 99.5).toFixed(2)}%`;

  el.style.setProperty("--sk-v11-marker-rotate", deg);
  el.style.setProperty("--sk-v11-marker-skew-y", skewY);
  el.style.setProperty("--sk-v11-marker-trim-right", trim);
  el.style.setProperty("--sk-v11-marker-trim-right-top", `${trimTop.toFixed(2)}px`);
  el.style.setProperty("--sk-v11-marker-trim-right-bottom", `${trimBottom.toFixed(2)}px`);
  el.style.setProperty("--sk-v11-marker-offset-x", shiftX);
  el.style.setProperty("--sk-v11-marker-gloss", gloss);
  el.style.setProperty("--sk-v11-marker-tail", tail);
}

function seedCharShellV11(shell: HTMLElement): void {
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
    if (seededMarkerFieldElements.has(el)) continue;

    const fieldSeed = `${shellSeed}|${fieldIndex}|${el.getAttribute("data-hg-lore-ph") ?? ""}|${el.className}`;
    fieldIndex += 1;
    seededMarkerFieldElements.add(el);
    applyMarkerTiltVars(el, fieldSeed);
  }
}

function seedLocOrdoV7Root(root: HTMLElement): void {
  const shellSeed =
    root.getAttribute("data-hg-lore-ordo-node-id")?.trim() ||
    root.getAttribute("data-testid")?.trim() ||
    "ordo-v7";

  let fieldIndex = 0;
  for (const el of root.querySelectorAll<HTMLElement>("[data-hg-lore-field]")) {
    if (el.closest("[data-hg-lore-location-notes]")) continue;
    if (seededMarkerFieldElements.has(el)) continue;

    const fieldSeed = `${shellSeed}|${fieldIndex}|${el.getAttribute("data-hg-lore-ph") ?? ""}|${el.className}`;
    fieldIndex += 1;
    seededMarkerFieldElements.add(el);
    applyMarkerTiltVars(el, fieldSeed);
  }
}

/**
 * Assigns per-field marker jitter vars once per field element (character or ORDO location v7).
 * Skips notes + header catalog line (character); skips lore notes cell (ORDO).
 * Idempotent per DOM node so rerenders do not reshuffle jitter, but remounted fields get a fresh seed pass.
 */
export function syncLoreV11MarkerTilts(host: HTMLElement | null): void {
  if (!host || typeof document === "undefined") return;

  const charShell = host.matches?.('[class*="charSkShellV11"]')
    ? host
    : host.querySelector<HTMLElement>('[class*="charSkShellV11"]');
  if (charShell) {
    seedCharShellV11(charShell);
    return;
  }

  const ordoRoot = host.matches?.('[class*="locOrdoV7Root"]')
    ? host
    : host.querySelector<HTMLElement>('[class*="locOrdoV7Root"]');
  if (ordoRoot) {
    seedLocOrdoV7Root(ordoRoot);
  }
}
