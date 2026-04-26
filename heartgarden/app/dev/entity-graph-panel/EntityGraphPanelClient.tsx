"use client";

import { VigilThemeProvider } from "@/src/contexts/vigil-theme-context";
import { EntityGraphPanelLab } from "@/src/components/dev/EntityGraphPanelLab";

export function EntityGraphPanelClient() {
  return (
    <VigilThemeProvider>
      <EntityGraphPanelLab />
    </VigilThemeProvider>
  );
}
