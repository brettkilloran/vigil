"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "vigil-color-scheme";

export type VigilColorScheme = "system" | "light" | "dark";

function readStored(): VigilColorScheme {
  if (typeof window === "undefined") {
    return "system";
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") {
    return raw;
  }
  return "system";
}

export function useVigilTheme() {
  const [preference, setPreference] = useState<VigilColorScheme>(() =>
    readStored()
  );
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const resolved: "light" | "dark" =
    preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    const root = document.documentElement;
    if (preference === "system") {
      root.removeAttribute("data-vigil-theme");
    } else {
      root.setAttribute("data-vigil-theme", preference);
    }
    root.style.colorScheme = resolved;
    /* Tailwind `dark:*` must track resolved theme, not only prefers-color-scheme. */
    root.classList.toggle("dark", resolved === "dark");
  }, [preference, resolved]);

  const setAndStore = useCallback((next: VigilColorScheme) => {
    setPreference(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const cyclePreference = useCallback(() => {
    const order: VigilColorScheme[] = ["system", "light", "dark"];
    const i = order.indexOf(preference);
    setAndStore(order[(i + 1) % order.length]!);
  }, [preference, setAndStore]);

  return { preference, resolved, setPreference: setAndStore, cyclePreference };
}
