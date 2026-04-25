import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SmartImportQuestionsDemo } from "./smart-import-questions-demo";

export const metadata: Metadata = {
  description: "Dev preview of the Smart Import question wizard flow.",
  robots: { follow: false, index: false },
  title: "Smart import questions — style preview",
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
