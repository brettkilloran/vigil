"use client";

import { EntityGraphLab } from "@/src/components/dev/entity-graph-lab";
import { VigilThemeProvider } from "@/src/contexts/vigil-theme-context";

/**
 * Renders the lab in the same theme shell as the main app (CSS variables + any context consumers)
 * without going through `next/dynamic` — a stuck “loading lab…” state usually means the dynamic
 * chunk never finished loading; a static import keeps this route reliable in dev.
 */
export function EntityGraphClient() {
  return (
    <VigilThemeProvider>
      <EntityGraphLab />
    </VigilThemeProvider>
  );
}
