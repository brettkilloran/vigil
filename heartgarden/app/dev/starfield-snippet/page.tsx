import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StarfieldSnippetClient } from "./StarfieldSnippetClient";

export const metadata: Metadata = {
  title: "Starfield snippet — lab",
  description: "Isolated ambient starfield snippet renderer for visual debugging.",
  robots: { index: false, follow: false },
};

export default function StarfieldSnippetPage() {
  if (process.env.NODE_ENV === "production" && process.env.HEARTGARDEN_ENABLE_DEV_ROUTES !== "1") {
    notFound();
  }
  return <StarfieldSnippetClient />;
}
