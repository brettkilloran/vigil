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
        maxCssPixels: 200,
        devicePixelRatio: 2,
      }),
    ).toBe("https://x.example/img.png");
  });

  it("applies template with w and encoded url", () => {
    process.env.NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE =
      "https://cdn.example/cdn-cgi/image/width={w}/{url}";
    const out = resolveImageDisplayUrl("https://r2.example/bucket/a b.png", {
      maxCssPixels: 100,
      devicePixelRatio: 2,
    });
    expect(out).toBe(
      `https://cdn.example/cdn-cgi/image/width=200/${encodeURIComponent("https://r2.example/bucket/a b.png")}`,
    );
  });

  it("useFullResolution skips template", () => {
    process.env.NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE =
      "https://cdn.example/cdn-cgi/image/width={w}/{url}";
    expect(
      resolveImageDisplayUrl("https://x.example/img.png", {
        maxCssPixels: 50,
        devicePixelRatio: 2,
        useFullResolution: true,
      }),
    ).toBe("https://x.example/img.png");
  });

  it("clamps width bounds", () => {
    process.env.NEXT_PUBLIC_HEARTGARDEN_IMAGE_URL_TEMPLATE = "https://x/w={w}/u={url}";
    const huge = resolveImageDisplayUrl("https://a/b", {
      maxCssPixels: 99999,
      devicePixelRatio: 99,
    });
    expect(huge).toContain("w=4096");
  });
});
