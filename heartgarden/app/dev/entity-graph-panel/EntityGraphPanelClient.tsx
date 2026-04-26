"use client";

import { useEffect, useState } from "react";

import { VigilThemeProvider } from "@/src/contexts/vigil-theme-context";
import { EntityGraphPanelLab } from "@/src/components/dev/EntityGraphPanelLab";

export function EntityGraphPanelClient() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <VigilThemeProvider>
      <EntityGraphPanelLab />
    </VigilThemeProvider>
  );
}
