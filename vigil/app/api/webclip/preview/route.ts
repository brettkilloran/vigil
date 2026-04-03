import { NextResponse } from "next/server";
import { z } from "zod";

import { webclipMshotUrl } from "@/src/lib/webclip-preview";

const bodySchema = z.object({
  url: z.string().url().max(8192),
});

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

  let ogImage: string | null = null;
  let pageTitle: string | null = null;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; VIGIL-Webclip/1.0; +https://github.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(t);
    if (res.ok) {
      const html = await res.text();
      ogImage = pickOgImage(html);
      pageTitle = pickTitle(html);
    }
  } catch {
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
