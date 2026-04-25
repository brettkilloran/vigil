export const PRESENCE_DISPLAY_NAME_MAX_CHARS = 32;

/**
 * Keep this strict so names stay readable in small cursor labels/chips and do not introduce
 * odd punctuation noise. Unicode letters/numbers are allowed.
 */
const PRESENCE_DISPLAY_NAME_ALLOWED_RE = /^[\p{L}\p{N}][\p{L}\p{N}\s.'_-]*$/u;

const PRESENCE_ALIAS_LEFT = [
  "Aether",
  "Ashen",
  "Astral",
  "Black",
  "Bleak",
  "Crimson",
  "Ebon",
  "Eldritch",
  "Gloam",
  "Hollow",
  "Ivory",
  "Liminal",
  "Nocturne",
  "Obsidian",
  "Pale",
  "Raven",
  "Sable",
  "Silent",
  "Umbral",
  "Veiled",
] as const;

const PRESENCE_ALIAS_RIGHT = [
  "Arcana",
  "Beacon",
  "Censer",
  "Chalice",
  "Cipher",
  "Covenant",
  "Crown",
  "Dagger",
  "Glyph",
  "Grimoire",
  "Hex",
  "Lantern",
  "Mirror",
  "Omen",
  "Oracle",
  "Ritual",
  "Rune",
  "Sanctum",
  "Sigil",
  "Talisman",
] as const;

export const PRESENCE_SIGIL_VARIANTS = [
  "thread",
  "quill",
  "atlas",
  "bloom",
] as const;
export type PresenceSigilVariant = (typeof PRESENCE_SIGIL_VARIANTS)[number];

/** Legacy anonymous identity (still used outside player scope). */
const PRESENCE_EMOJI_PALETTE = [
  "🙂",
  "🌸",
  "🦊",
  "🐙",
  "🌊",
  "🍀",
  "🎨",
  "📎",
  "✨",
  "🔮",
  "🦋",
  "🌙",
  "🍵",
  "🎭",
  "🧭",
  "📚",
  "🪴",
  "🐚",
  "🌈",
  "⚡",
  "🪶",
  "🧩",
  "🎪",
  "🛰️",
] as const;

function hashUuidToUint32(uuid: string): number {
  let h = 2_166_136_261;
  for (let i = 0; i < uuid.length; i++) {
    h ^= uuid.charCodeAt(i);
    h = Math.imul(h, 16_777_619);
  }
  return h >>> 0;
}

function normalizeHashInput(value: string): string {
  return value.trim().toLowerCase();
}

export function presenceEmojiForClientId(clientId: string): string {
  const h = hashUuidToUint32(normalizeHashInput(clientId));
  return PRESENCE_EMOJI_PALETTE[h % PRESENCE_EMOJI_PALETTE.length] ?? "🙂";
}

export function sanitizePresenceDisplayName(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const compact = raw.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (compact.length < 1 || compact.length > PRESENCE_DISPLAY_NAME_MAX_CHARS) {
    return null;
  }
  return PRESENCE_DISPLAY_NAME_ALLOWED_RE.test(compact) ? compact : null;
}

export function presenceFallbackAliasForClientId(clientId: string): string {
  const h = hashUuidToUint32(normalizeHashInput(clientId));
  const left = PRESENCE_ALIAS_LEFT[h % PRESENCE_ALIAS_LEFT.length] ?? "North";
  const right =
    PRESENCE_ALIAS_RIGHT[
      Math.floor(h / PRESENCE_ALIAS_LEFT.length) % PRESENCE_ALIAS_RIGHT.length
    ] ?? "Atlas";
  return `${left} ${right}`;
}

export function presenceNameForClient(
  clientId: string,
  displayName: string | null | undefined
): string {
  return (
    sanitizePresenceDisplayName(displayName) ??
    presenceFallbackAliasForClientId(clientId)
  );
}

export function presenceInitialsFromName(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  const first = tokens[0]?.[0] ?? "";
  const last =
    tokens.length > 1
      ? (tokens[tokens.length - 1]?.[0] ?? "")
      : (tokens[0]?.[1] ?? "");
  const out = `${first}${last}`.trim().toUpperCase();
  return out.length > 0 ? out.slice(0, 2) : "??";
}

export function presenceSigilForClientId(
  clientId: string
): PresenceSigilVariant {
  const h = hashUuidToUint32(normalizeHashInput(clientId));
  return (
    PRESENCE_SIGIL_VARIANTS[h % PRESENCE_SIGIL_VARIANTS.length] ?? "thread"
  );
}

export function presenceSigilLabel(
  sigil: PresenceSigilVariant | null | undefined
): string {
  if (sigil === "quill") {
    return "Quill";
  }
  if (sigil === "atlas") {
    return "Atlas";
  }
  if (sigil === "bloom") {
    return "Bloom";
  }
  return "Thread";
}

/** CSS `hue` 0–360 for collaborator chrome (pointer + ring). */
export function presenceHueForClientId(clientId: string): number {
  return hashUuidToUint32(normalizeHashInput(clientId)) % 360;
}

export function presenceCursorColor(clientId: string): string {
  const hue = presenceHueForClientId(clientId);
  return `oklch(0.72 0.14 ${hue})`;
}
