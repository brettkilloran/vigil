"use client";

import { createContext, type ReactNode, useContext } from "react";

import { useVigilTheme } from "@/src/hooks/use-vigil-theme";

type VigilThemeValue = ReturnType<typeof useVigilTheme>;

const VigilThemeContext = createContext<VigilThemeValue | null>(null);

export function VigilThemeProvider({ children }: { children: ReactNode }) {
  const value = useVigilTheme();
  return (
    <VigilThemeContext.Provider value={value}>
      {children}
    </VigilThemeContext.Provider>
  );
}

export function useVigilThemeContext(): VigilThemeValue {
  const ctx = useContext(VigilThemeContext);
  if (!ctx) {
    throw new Error(
      "useVigilThemeContext must be used within VigilThemeProvider"
    );
  }
  return ctx;
}

export type { VigilColorScheme } from "@/src/hooks/use-vigil-theme";
