type AtlasEntry = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};

export class TextAtlas {
  private cache = new Map<string, AtlasEntry>();

  getLabel(label: string, active: boolean): AtlasEntry {
    const key = `${active ? "active" : "default"}:${label}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas unavailable");

    const fontSize = active ? 12 : 11;
    const fontWeight = active ? 700 : 600;
    const font = `${fontWeight} ${fontSize}px var(--font-geist-sans), sans-serif`;
    ctx.font = font;
    const measured = Math.ceil(ctx.measureText(label).width);
    const width = Math.max(42, measured + 18);
    const height = active ? 26 : 22;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(height * dpr);
    ctx.scale(dpr, dpr);

    const radius = height * 0.5;
    ctx.fillStyle = active ? "rgba(252,252,253,0.95)" : "rgba(255,255,255,0.18)";
    ctx.strokeStyle = active ? "rgba(244,162,84,0.92)" : "rgba(255,255,255,0.42)";
    ctx.lineWidth = active ? 1.3 : 1;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.arcTo(width, 0, width, height, radius);
    ctx.arcTo(width, height, 0, height, radius);
    ctx.arcTo(0, height, 0, 0, radius);
    ctx.arcTo(0, 0, width, 0, radius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = active ? "rgba(11,11,12,0.95)" : "rgba(240,242,245,0.96)";
    ctx.fillText(label, width * 0.5, height * 0.52);

    const next = { canvas, width, height };
    this.cache.set(key, next);
    return next;
  }

  clear(): void {
    this.cache.clear();
  }
}
