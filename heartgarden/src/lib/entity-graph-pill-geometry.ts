export type PillGeometry = {
  width: number;
  height: number;
  collisionRadius: number;
};

export function estimatePillGeometry(title: string, maxChars = 28): PillGeometry {
  const visibleLen = Math.min(maxChars, title.length);
  const estCharPx = 6.4;
  const width = Math.min(260, Math.max(64, visibleLen * estCharPx + 26));
  const height = 30;
  return {
    width,
    height,
    collisionRadius: Math.hypot(width / 2, height / 2) + 8,
  };
}
