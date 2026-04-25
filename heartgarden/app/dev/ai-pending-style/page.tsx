import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AiPendingStyleDemo } from "./AiPendingStyleDemo";

export const metadata: Metadata = {
  title: "AI pending text — style preview",
  description: "Dev preview of unreviewed import / LLM body styling.",
  robots: { index: false, follow: false },
};

export default function AiPendingStylePage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.HEARTGARDEN_ENABLE_DEV_ROUTES !== "1"
  ) {
    notFound();
  }
  return <AiPendingStyleDemo />;
}
