import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SmartImportQuestionsDemo } from "./SmartImportQuestionsDemo";

export const metadata: Metadata = {
  title: "Smart import questions — style preview",
  description: "Dev preview of the Smart Import question wizard flow.",
  robots: { index: false, follow: false },
};

export default function SmartImportQuestionsPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.HEARTGARDEN_ENABLE_DEV_ROUTES !== "1"
  ) {
    notFound();
  }
  return <SmartImportQuestionsDemo />;
}
