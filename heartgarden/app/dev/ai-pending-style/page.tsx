import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AiPendingStyleDemo } from "./AiPendingStyleDemo";

export const metadata: Metadata = {
  description: "Dev preview of unreviewed import / LLM body styling.",
  robots: { follow: false, index: false },
  title: "AI pending text — style preview",
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
