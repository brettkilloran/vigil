import { Suspense } from "react";
import { VigilThemeProvider } from "@/src/contexts/vigil-theme-context";
import { HEARTGARDEN_BRAND_MARK_EMOJI } from "@/src/lib/brand-mark";
import VigilApp from "./_components/VigilApp";

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
              color: "var(--vigil-muted)",
              backgroundColor: "#0c0c0e",
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
