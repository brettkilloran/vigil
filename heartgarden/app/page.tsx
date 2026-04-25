import { Suspense } from "react";

import { VigilThemeProvider } from "@/src/contexts/vigil-theme-context";
import { HEARTGARDEN_BRAND_MARK_EMOJI } from "@/src/lib/brand-mark";

import VigilApp from "./_components/vigil-app";

export default function Home() {
  return (
    <VigilThemeProvider>
      <Suspense
        fallback={
          <div
            style={{
              alignItems: "center",
              backgroundColor: "#0c0c0e",
              color: "var(--vigil-muted)",
              display: "flex",
              fontFamily: "system-ui, sans-serif",
              height: "100vh",
              justifyContent: "center",
              width: "100vw",
            }}
          >
            {HEARTGARDEN_BRAND_MARK_EMOJI} Loading heartgarden…
          </div>
        }
      >
        <VigilApp />
      </Suspense>
    </VigilThemeProvider>
  );
}
