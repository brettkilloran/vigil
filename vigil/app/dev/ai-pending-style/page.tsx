import type { Metadata } from "next";

import { AiPendingStyleDemo } from "./AiPendingStyleDemo";

export const metadata: Metadata = {
  title: "AI pending text — style preview",
  description: "Dev preview of unreviewed import / LLM body styling.",
  robots: { index: false, follow: false },
};

export default function AiPendingStylePage() {
  return <AiPendingStyleDemo />;
}
