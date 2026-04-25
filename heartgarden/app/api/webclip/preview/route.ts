import { NextResponse } from "next/server";
import { z } from "zod";

import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
} from "@/src/lib/heartgarden-api-boot-context";
import { webclipMshotUrl } from "@/src/lib/webclip-preview";
import { assertWebclipFetchTargetAllowed } from "@/src/lib/webclip-ssrf";

const bodySchema = z.object({
  url: z.string().url().max(8192),
});
const WEBCLIP_FETCH_TIMEOUT_MS = 8000;
const WEBCLIP_MAX_REDIRECTS = 5;

const OG_IMAGE_META_PROPERTY_FIRST_RE =
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;
const OG_IMAGE_META_CONTENT_FIRST_RE =
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i;
const OG_TITLE_META_PROPERTY_FIRST_RE =
  /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i;
const HTML_TITLE_TAG_RE = /<title[^>]*>([^<]{1,200})<\/title>/i;
const HTTP_PROTOCOL_RE = /^https?:\/\//i;

function pickOgImage(html: string): string | null {
  const m = html.match(OG_IMAGE_META_PROPERTY_FIRST_RE);
  if (m?.[1]) {
    return m[1].trim();
  }
  const m2 = html.match(OG_IMAGE_META_CONTENT_FIRST_RE);
  return m2?.[1]?.trim() ?? null;
}

function pickTitle(html: string): string | null {
  const m = html.match(OG_TITLE_META_PROPERTY_FIRST_RE);
  if (m?.[1]) {
    return m[1].trim();
  }
  const t = html.match(HTML_TITLE_TAG_RE);
  return t?.[1]?.trim() ?? null;
}

/**
 * Server-side web clip metadata + preview strategy (Phase 3).
 * Uses og:image when present; always returns mshots URL as screenshot fallback.
 */
export async function POST(req: Request) {
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) {
    return denied;
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON", ok: false },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid url", ok: false },
      { status: 400 }
    );
  }

  const url = parsed.data.url;
  if (!HTTP_PROTOCOL_RE.test(url)) {
    return NextResponse.json(
      { error: "HTTP(S) only", ok: false },
      { status: 400 }
    );
  }
  let startUrl: URL;
  try {
    startUrl = new URL(url);
  } catch {
    return NextResponse.json(
      { error: "Invalid url", ok: false },
      { status: 400 }
    );
  }
  try {
    await assertWebclipFetchTargetAllowed(startUrl);
  } catch {
    return NextResponse.json(
      { error: "Blocked URL target", ok: false },
      { status: 400 }
    );
  }

  let ogImage: string | null = null;
  let pageTitle: string | null = null;

  try {
    let current = startUrl;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), WEBCLIP_FETCH_TIMEOUT_MS);
    let res: Response | null = null;
    try {
      for (let hop = 0; hop <= WEBCLIP_MAX_REDIRECTS; hop += 1) {
        await assertWebclipFetchTargetAllowed(current);
        res = await fetch(current, {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent":
              "Mozilla/5.0 (compatible; heartgarden-Webclip/1.0; +https://github.com)",
          },
          redirect: "manual",
          signal: ctrl.signal,
        });
        const status = res.status;
        const isRedirect = status >= 300 && status < 400;
        if (!isRedirect) {
          break;
        }
        const location = res.headers.get("location");
        if (!location) {
          break;
        }
        current = new URL(location, current);
      }
    } finally {
      clearTimeout(t);
    }
    if (!res) {
      throw new Error("webclip fetch failed");
    }
    if (res.ok) {
      const html = await res.text();
      ogImage = pickOgImage(html);
      pageTitle = pickTitle(html);
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Blocked webclip target:")
    ) {
      return NextResponse.json(
        { error: "Blocked redirect target", ok: false },
        { status: 400 }
      );
    }
    /* use mshots only */
  }

  return NextResponse.json({
    ogImage,
    ok: true,
    pageTitle,
    screenshotUrl: webclipMshotUrl(url, 900),
    url,
  });
}
