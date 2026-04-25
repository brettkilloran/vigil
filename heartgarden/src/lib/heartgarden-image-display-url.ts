/**
 * Client-side image URL selection for canvas media cards.
 *
 * When `NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE` is set, `{w}` is replaced with the
 * target decode width in pixels and `{url}` with `encodeURIComponent(originalUrl)` — e.g. a
 * Cloudflare Image Resizing prefix:
 * `https://example.com/cdn-cgi/image/width={w},fit=scale-down,format=auto,quality=82/{url}`
 *
 * Without a template, returns `originalUrl` unchanged.
 */
export function resolveImageDisplayUrl(
  originalUrl: string,
  options: {
    /** Approximate displayed width in CSS pixels (card × canvas zoom). */
    maxCssPixels: number;
    devicePixelRatio: number;
    /** When true (e.g. gallery / focus), skip resizing. */
    useFullResolution?: boolean;
  }
): string {
  const { maxCssPixels, devicePixelRatio, useFullResolution } = options;
  if (!originalUrl || useFullResolution) {
    return originalUrl;
  }
  if (
    !(originalUrl.startsWith("http://") || originalUrl.startsWith("https://"))
  ) {
    return originalUrl;
  }

  const template =
    typeof process === "undefined"
      ? ""
      : (process.env.NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE ?? "").trim();
  if (!template) {
    return originalUrl;
  }

  const dpr =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1;
  const w = Math.min(
    4096,
    Math.max(32, Math.ceil(Math.max(1, maxCssPixels) * dpr))
  );

  if (!(template.includes("{w}") && template.includes("{url}"))) {
    return originalUrl;
  }

  return template
    .replaceAll("{w}", String(w))
    .replaceAll("{url}", encodeURIComponent(originalUrl));
}
