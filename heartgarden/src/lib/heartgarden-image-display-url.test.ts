import { afterEach, describe, expect, it } from "vitest";

import { resolveImageDisplayUrl } from "@/src/lib/heartgarden-image-display-url";

describe("resolveImageDisplayUrl", () => {
  const orig = process.env.NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE;

  afterEach(() => {
    if (orig === undefined) {
      delete process.env.NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE;
    } else {
      process.env.NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE = orig;
    }
  });

  it("returns original when no template", () => {
    delete process.env.NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE;
    expect(
      resolveImageDisplayUrl("https://x.example/img.png", {
        devicePixelRatio: 2,
        maxCssPixels: 200,
      })
    ).toBe("https://x.example/img.png");
  });

  it("applies template with w and encoded url", () => {
    process.env.NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE =
      "https://cdn.example/cdn-cgi/image/width={w}/{url}";
    const out = resolveImageDisplayUrl("https://r2.example/bucket/a b.png", {
      devicePixelRatio: 2,
      maxCssPixels: 100,
    });
    expect(out).toBe(
      `https://cdn.example/cdn-cgi/image/width=200/${encodeURIComponent("https://r2.example/bucket/a b.png")}`
    );
  });

  it("useFullResolution skips template", () => {
    process.env.NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE =
      "https://cdn.example/cdn-cgi/image/width={w}/{url}";
    expect(
      resolveImageDisplayUrl("https://x.example/img.png", {
        devicePixelRatio: 2,
        maxCssPixels: 50,
        useFullResolution: true,
      })
    ).toBe("https://x.example/img.png");
  });

  it("clamps width bounds", () => {
    process.env.NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE =
      "https://x/w={w}/u={url}";
    const huge = resolveImageDisplayUrl("https://a/b", {
      devicePixelRatio: 99,
      maxCssPixels: 99_999,
    });
    expect(huge).toContain("w=4096");
  });
});
