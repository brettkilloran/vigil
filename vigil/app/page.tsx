import { Suspense } from "react";

import VigilApp from "./_components/VigilApp";

export default function Home() {
  return (
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
            color: "#555",
          }}
        >
          Loading VIGIL…
        </div>
      }
    >
      <VigilApp />
    </Suspense>
  );
}
