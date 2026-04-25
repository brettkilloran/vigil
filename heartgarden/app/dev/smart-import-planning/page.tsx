import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SmartImportPlanningDemo } from "./smart-import-planning-demo";

export const metadata: Metadata = {
  description:
    "Dev preview of the simplified Smart Import planning modal (spinner).",
  robots: { follow: false, index: false },
  title: "Smart import planning — style preview",
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
