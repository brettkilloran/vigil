import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SmartImportPlanningDemo } from "./SmartImportPlanningDemo";

export const metadata: Metadata = {
  title: "Smart import planning — style preview",
  description: "Dev preview of the simplified Smart Import planning modal (spinner).",
  robots: { index: false, follow: false },
};

export default function SmartImportPlanningPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.HEARTGARDEN_ENABLE_DEV_ROUTES !== "1"
  ) {
    notFound();
  }
  return <SmartImportPlanningDemo />;
}
