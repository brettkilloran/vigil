"use client";

import { useSyncExternalStore } from "react";

/**
 * Dev-only "pin popovers open" flag. When enabled, participating popovers
 * (e.g. `ArchitecturalConnectionKindPicker`) ignore outside-pointerdown and
 * Escape dismissals so the element tree can be inspected in DevTools without
 * the popover evaporating on the first click.
 *
 * Behavior:
 * - Always `false` in production builds (tree-shaken to a constant).
 * - In dev, initial value comes from (in order):
 *   1. `?pinPopovers=1` on the current URL.
 *   2. `localStorage["hg:pinPopovers"] === "1"`.
 * - Toggle at runtime with **Alt+Shift+P** (status logged to the console).
 *   Toggle persists to `localStorage` across reloads.
 *
 * Do **not** call this outside dev flows — popovers that never close break
 * core keyboard/focus flows. The `engaged` prop (app state) still wins.
 */

const STORAGE_KEY = "hg:pinPopovers";
const EVENT_NAME = "hg:pin-popovers-changed";

let currentValue = false;
let initialized = false;

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

function readInitial(): boolean {
  if (!isDev() || typeof window === "undefined") {
    return false;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("pinPopovers");
    if (fromUrl === "1" || fromUrl === "true") {
      return true;
    }
    if (fromUrl === "0" || fromUrl === "false") {
      return false;
    }
  } catch {
    // ignore URL parse issues — only used as a seed
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function initOnce() {
  if (initialized || typeof window === "undefined" || !isDev()) {
    return;
  }
  initialized = true;
  currentValue = readInitial();

  const onKey = (event: KeyboardEvent) => {
    // Alt+Shift+P, ignore when typing in fields to avoid surprises.
    if (!(event.altKey && event.shiftKey)) {
      return;
    }
    if (event.code !== "KeyP" && event.key.toLowerCase() !== "p") {
      return;
    }
    const t = event.target as HTMLElement | null;
    const tag = t?.tagName;
    if (
      t &&
      (tag === "INPUT" ||
        tag === "TEXTAREA" ||
        t.isContentEditable ||
        t.getAttribute?.("role") === "textbox")
    ) {
      return;
    }
    event.preventDefault();
    setPinnedPopovers(!currentValue);
    console.info(
      `[hg] Pin popovers: ${currentValue ? "ON" : "OFF"} (Alt+Shift+P to toggle)`
    );
  };
  window.addEventListener("keydown", onKey, true);
}

function subscribe(listener: () => void): () => void {
  if (!isDev() || typeof window === "undefined") {
    return () => {
      /* noop */
    };
  }
  initOnce();
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

function getSnapshot(): boolean {
  return getPinnedPopovers();
}

function getServerSnapshot(): boolean {
  return false;
}

export function getPinnedPopovers(): boolean {
  if (!isDev()) {
    return false;
  }
  initOnce();
  return currentValue;
}

export function setPinnedPopovers(next: boolean): void {
  if (!isDev() || typeof window === "undefined") {
    return;
  }
  initOnce();
  if (currentValue === next) {
    return;
  }
  currentValue = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
}

/**
 * Subscribe to the pin flag. Returns `false` in production without
 * registering any listeners. SSR-safe (renders `false` on the server).
 */
export function useDevPinnedPopovers(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
