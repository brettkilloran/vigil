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
            search: "⌘K",
            undo: "⌘Z",
            redo: "⇧⌘Z",
            stack: "⌘S",
            bold: "⌘B",
            italic: "⌘I",
            underline: "⌘U",
            recenter: "⌘0",
          }
        : {
            search: "Ctrl+K",
            undo: "Ctrl+Z",
            redo: "Ctrl+Shift+Z",
            stack: "Ctrl+S",
            bold: "Ctrl+B",
            italic: "Ctrl+I",
            underline: "Ctrl+U",
            recenter: "Ctrl+0",
          },
    [apple]
  );
}
