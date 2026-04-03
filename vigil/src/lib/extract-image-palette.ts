/**
 * Sample dominant colors from a raster image (client-side).
 * Returns up to `max` hex strings, sorted by saturation then frequency proxy.
 */
export async function extractImagePalette(
  imageUrl: string,
  max = 5,
): Promise<string[]> {
  if (typeof window === "undefined" || !imageUrl) return [];

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = Math.min(64, img.naturalWidth || img.width);
        const h = Math.min(64, img.naturalHeight || img.height);
        if (w < 2 || h < 2) {
          resolve([]);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve([]);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        const buckets = new Map<string, number>();
        const step = 4 * 3;
        for (let i = 0; i < data.length; i += step) {
          const a = data[i + 3] ?? 255;
          if (a < 20) continue;
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          const qr = Math.round(r / 24) * 24;
          const qg = Math.round(g / 24) * 24;
          const qb = Math.round(b / 24) * 24;
          const key = `${qr},${qg},${qb}`;
          buckets.set(key, (buckets.get(key) ?? 0) + 1);
        }
        const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
        const out: string[] = [];
        for (const [rgb] of sorted) {
          const [r, g, b] = rgb.split(",").map(Number);
          const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
          if (!out.includes(hex)) out.push(hex);
          if (out.length >= max) break;
        }
        resolve(out);
      } catch {
        resolve([]);
      }
    };
    img.onerror = () => resolve([]);
    img.src = imageUrl;
  });
}
