"use client";

import { useMemo, useSyncExternalStore } from "react";

function isAppleOS(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const p = nav.userAgentData?.platform ?? "";
  if (/Mac|iPhone|iPod|iPad/i.test(p)) {
    return true;
  }
  const ua = navigator.userAgent;
  return /Mac OS X|Macintosh|iPhone|iPad|iPod/.test(ua);
}

const noopSubscribe = () => () => {};

/**
 * macOS / iOS use ⌘; Windows and Linux use Ctrl for the same handlers
 * (`metaKey || ctrlKey` in keydown).
 */
export function useIsAppleOS(): boolean {
  return useSyncExternalStore(noopSubscribe, isAppleOS, () => false);
}

/** Labels for toolbar and placeholders (hydration-safe: Windows-style until client). */
export function useModKeyHints() {
  const apple = useIsAppleOS();
  return useMemo(
    () =>
      apple
        ? {
            bold: "⌘B",
            italic: "⌘I",
            recenter: "⌘0",
            redo: "⇧⌘Z",
            search: "⌘K",
            stack: "⌘S",
            underline: "⌘U",
            undo: "⌘Z",
          }
        : {
            bold: "Ctrl+B",
            italic: "Ctrl+I",
            recenter: "Ctrl+0",
            redo: "Ctrl+Shift+Z",
            search: "Ctrl+K",
            stack: "Ctrl+S",
            underline: "Ctrl+U",
            undo: "Ctrl+Z",
          },
    [apple]
  );
}
