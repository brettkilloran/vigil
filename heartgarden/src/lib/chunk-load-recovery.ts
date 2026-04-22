"use client";

import { useEffect } from "react";

const CHUNK_LOAD_RELOAD_SESSION_KEY = "hg:chunk-load-reload-at";
const CHUNK_LOAD_RELOAD_COOLDOWN_MS = 15_000;

function chunkFailureMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  if (reason && typeof reason === "object" && "message" in reason) {
    const message = (reason as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(reason ?? "");
}

function isChunkLoadFailure(reason: unknown): boolean {
  const message = chunkFailureMessage(reason).toLowerCase();
  if (!message) return false;
  return (
    message.includes("chunkloaderror") ||
    (message.includes("loading chunk") && message.includes("failed")) ||
    message.includes("failed to fetch dynamically imported module")
  );
}

function readChunkReloadAt(): number {
  const raw = window.sessionStorage.getItem(CHUNK_LOAD_RELOAD_SESSION_KEY);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function markChunkReloadAt(now: number): void {
  window.sessionStorage.setItem(CHUNK_LOAD_RELOAD_SESSION_KEY, String(now));
}

/**
 * Recover from stale/missed Next chunk URLs by reloading once per cooldown window.
 * This is intentionally conservative to avoid reload loops.
 */
export function useChunkLoadRecovery(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const attemptRecovery = (reason: unknown) => {
      if (!isChunkLoadFailure(reason)) return;
      const now = Date.now();
      if (now - readChunkReloadAt() < CHUNK_LOAD_RELOAD_COOLDOWN_MS) return;
      markChunkReloadAt(now);
      window.location.reload();
    };

    const onWindowError = (event: ErrorEvent) => {
      attemptRecovery(event.error ?? event.message ?? event);
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      attemptRecovery(event.reason);
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);
}
