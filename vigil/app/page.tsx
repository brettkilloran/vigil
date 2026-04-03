import { Suspense } from "react";

import VigilApp from "./_components/VigilApp";
import { VigilThemeProvider } from "@/src/contexts/vigil-theme-context";

export default function Home() {
  return (
    <VigilThemeProvider>
    <Suspense
      fallback={
        <div
          style={{
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, sans-serif",
            color: "var(--vigil-muted, #555)",
          }}
        >
          Loading VIGIL…
        </div>
      }
    >
      <VigilApp />
    </Suspense>
    </VigilThemeProvider>
  );
}
