import { NextResponse } from "next/server";
import { z } from "zod";

import {
  enforceGmOnlyBootContext,
  getHeartgardenApiBootContext,
} from "@/src/lib/heartgarden-api-boot-context";
import { assertWebclipFetchTargetAllowed } from "@/src/lib/webclip-ssrf";
import { webclipMshotUrl } from "@/src/lib/webclip-preview";

const bodySchema = z.object({
  url: z.string().url().max(8192),
});
const WEBCLIP_FETCH_TIMEOUT_MS = 8_000;
const WEBCLIP_MAX_REDIRECTS = 5;

function pickOgImage(html: string): string | null {
  const m = html.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  );
  if (m?.[1]) return m[1].trim();
  const m2 = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  );
  return m2?.[1]?.trim() ?? null;
}

function pickTitle(html: string): string | null {
  const m = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  );
  if (m?.[1]) return m[1].trim();
  const t = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  return t?.[1]?.trim() ?? null;
}

/**
 * Server-side web clip metadata + preview strategy (Phase 3).
 * Uses og:image when present; always returns mshots URL as screenshot fallback.
 */
export async function POST(req: Request) {
  const bootCtx = await getHeartgardenApiBootContext();
  const denied = enforceGmOnlyBootContext(bootCtx);
  if (denied) return denied;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid url" },
      { status: 400 },
    );
  }

  const url = parsed.data.url;
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ ok: false, error: "HTTP(S) only" }, { status: 400 });
  }
  let startUrl: URL;
  try {
    startUrl = new URL(url);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid url" }, { status: 400 });
  }
  try {
    await assertWebclipFetchTargetAllowed(startUrl);
  } catch {
    return NextResponse.json({ ok: false, error: "Blocked URL target" }, { status: 400 });
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
          signal: ctrl.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; heartgarden-Webclip/1.0; +https://github.com)",
            Accept: "text/html,application/xhtml+xml",
          },
          redirect: "manual",
        });
        const status = res.status;
        const isRedirect = status >= 300 && status < 400;
        if (!isRedirect) break;
        const location = res.headers.get("location");
        if (!location) break;
        current = new URL(location, current);
      }
    } finally {
      clearTimeout(t);
    }
    if (!res) throw new Error("webclip fetch failed");
    if (res.ok) {
      const html = await res.text();
      ogImage = pickOgImage(html);
      pageTitle = pickTitle(html);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Blocked webclip target:")) {
      return NextResponse.json({ ok: false, error: "Blocked redirect target" }, { status: 400 });
    }
    /* use mshots only */
  }

  return NextResponse.json({
    ok: true,
    url,
    ogImage,
    pageTitle,
    screenshotUrl: webclipMshotUrl(url, 900),
  });
}
