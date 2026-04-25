import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EntityGraphClient } from "./EntityGraphClient";

export const metadata: Metadata = {
  title: "Entity graph — lab",
  description: "Standalone entity graph UX/UI sandbox with dummy content.",
  robots: { index: false, follow: false },
};

export default function EntityGraphPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.HEARTGARDEN_ENABLE_DEV_ROUTES !== "1"
  ) {
    notFound();
  }
  return <EntityGraphClient />;
}
