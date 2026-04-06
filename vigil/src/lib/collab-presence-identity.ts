/** Deterministic display emoji for a presence client id (no accounts). */
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
  let h = 2166136261;
  for (let i = 0; i < uuid.length; i++) {
    h ^= uuid.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function presenceEmojiForClientId(clientId: string): string {
  const h = hashUuidToUint32(clientId.trim().toLowerCase());
  return PRESENCE_EMOJI_PALETTE[h % PRESENCE_EMOJI_PALETTE.length] ?? "🙂";
}

/** CSS `hue` 0–360 for collaborator chrome (pointer + ring). */
export function presenceHueForClientId(clientId: string): number {
  return hashUuidToUint32(clientId) % 360;
}

export function presenceCursorColor(clientId: string): string {
  const hue = presenceHueForClientId(clientId);
  return `oklch(0.72 0.14 ${hue})`;
}
