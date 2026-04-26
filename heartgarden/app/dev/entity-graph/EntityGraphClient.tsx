"use client";

import { useSearchParams } from "next/navigation";

import { EntityGraphLab } from "@/src/components/dev/EntityGraphLab";
import { VigilThemeProvider } from "@/src/contexts/vigil-theme-context";

/**
 * Renders the lab in the same theme shell as the main app (CSS variables + any context consumers)
 * without going through `next/dynamic` — a stuck “loading lab…” state usually means the dynamic
 * chunk never finished loading; a static import keeps this route reliable in dev.
 */
export function EntityGraphClient() {
  const params = useSearchParams();
  const initialScenarioKey = params.get("scenario");
  const initialFilter = params.get("filter") ?? "";
  return (
    <VigilThemeProvider>
      <EntityGraphLab
        initialScenarioKey={initialScenarioKey}
        initialFilter={initialFilter}
      />
    </VigilThemeProvider>
  );
}
