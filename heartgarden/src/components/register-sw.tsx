"use client";

import { useEffect } from "react";

/** Minimal installable shell: registers a no-op SW in production so the app can be “installed”. */
export function RegisterSw() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (process.env.NODE_ENV !== "production") {
      return;
    }
    if (!("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore */
    });
  }, []);
  return null;
}
