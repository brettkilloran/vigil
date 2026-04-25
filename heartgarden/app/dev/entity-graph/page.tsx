import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EntityGraphClient } from "./entity-graph-client";

export const metadata: Metadata = {
  description: "Standalone entity graph UX/UI sandbox with dummy content.",
  robots: { follow: false, index: false },
  title: "Entity graph — lab",
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
