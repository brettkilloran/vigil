"use client";

import { ExternalLink, Globe, ImageIcon, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { VIGIL_CHIP_BTN } from "@/src/lib/vigil-ui-classes";
import { webclipMshotUrl } from "@/src/lib/webclip-preview";
import type { CanvasItem } from "@/src/stores/canvas-types";

type WebclipMeta = {
  previewUrl?: string;
  pageTitle?: string;
  lastFetched?: string;
};

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export function WebclipCard({
  item,
  active,
  onPatchItem,
}: {
  item: CanvasItem;
  active: boolean;
  onPatchItem: (id: string, patch: Partial<CanvasItem>) => void;
}) {
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftUrl, setDraftUrl] = useState(item.contentText?.trim() ?? "");

  useEffect(() => {
    setDraftUrl(item.contentText?.trim() ?? "");
  }, [item.contentText, item.id]);

  const url = normalizeUrl(item.contentText ?? "");
  const meta = useMemo(
    () => (item.imageMeta ?? {}) as WebclipMeta,
    [item.imageMeta],
  );
  const previewUrl =
    meta.previewUrl || (url ? webclipMshotUrl(url, 900) : null);

  const fetchPreview = useCallback(async () => {
    if (!url.startsWith("http")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/webclip/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        ogImage?: string | null;
        pageTitle?: string | null;
        screenshotUrl?: string;
        error?: string;
      };
      if (!data.ok) {
        setError(data.error ?? "Preview failed");
        return;
      }
      const nextPreview = data.ogImage || data.screenshotUrl || previewUrl;
      const t = item.title?.trim() ?? "";
      const useOgTitle =
        !t || t === "Web clip" || t === "Item" || t === "Untitled";
      const nextTitle =
        useOgTitle && data.pageTitle?.trim()
          ? data.pageTitle.trim().slice(0, 255)
          : item.title;
      onPatchItem(item.id, {
        title: nextTitle,
        imageMeta: {
          ...meta,
          previewUrl: nextPreview,
          pageTitle: data.pageTitle ?? undefined,
          lastFetched: new Date().toISOString(),
        },
      });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [url, item.id, item.title, meta, onPatchItem, previewUrl]);

  useEffect(() => {
    if (!active || !url.startsWith("http")) return;
    if (meta.lastFetched) return;
    void fetchPreview();
  }, [active, url, meta.lastFetched, fetchPreview]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--vigil-card-bg)]">
      {active ? (
        <label className="block border-b border-[var(--vigil-card-border)] px-2 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--vigil-muted)]">
            Page URL
          </span>
          <input
            type="url"
            className="mt-1 w-full rounded-md border border-[var(--vigil-border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vigil-snap)]/35"
            placeholder="https://example.com"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            onBlur={() => {
              const next = draftUrl.trim();
              if (next !== (item.contentText ?? "").trim()) {
                onPatchItem(item.id, { contentText: next });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
      ) : null}

      {!url.startsWith("http") ? (
        <div className="flex flex-1 flex-col justify-center gap-2 p-3">
          <p className="text-xs text-[var(--vigil-muted)]">
            {active
              ? "Enter a URL above. Preview uses Open Graph when available, plus a public page thumbnail service."
              : "Select this card to set a web clip URL."}
          </p>
        </div>
      ) : null}

      {url.startsWith("http") ? (
        <>
      {active ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--vigil-card-border)] px-2 py-1.5">
          <button
            type="button"
            className={VIGIL_CHIP_BTN}
            disabled={loading}
            onClick={() => void fetchPreview()}
          >
            <RefreshCw
              className={`size-[14px] shrink-0 ${loading ? "animate-spin" : ""}`}
              aria-hidden
            />
            Refresh preview
          </button>
          <button
            type="button"
            className={VIGIL_CHIP_BTN}
            onClick={() => setLive((v) => !v)}
          >
            <Globe className="size-[14px] shrink-0" aria-hidden />
            {live ? "Hide live" : "Live site"}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className={`${VIGIL_CHIP_BTN} no-underline`}
          >
            <ExternalLink className="size-[14px] shrink-0" aria-hidden />
            Open
          </a>
        </div>
      ) : null}

      {error && active ? (
        <p className="px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400">
          {error}
        </p>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {live ? (
          <iframe
            title={item.title}
            src={url}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-cover object-top"
              loading="lazy"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-3 pt-8">
              <p className="truncate text-[11px] text-white/95">{url}</p>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--vigil-muted)]">
            <ImageIcon className="size-8 opacity-50" aria-hidden />
            <span className="text-xs">No preview yet</span>
          </div>
        )}
      </div>
        </>
      ) : null}
    </div>
  );
}
