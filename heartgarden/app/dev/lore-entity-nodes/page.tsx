import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LoreEntityNodesClient } from "./lore-entity-nodes-client";

export const metadata: Metadata = {
  description:
    "Design previews for character, organization, and location canvas nodes.",
  robots: { follow: false, index: false },
  title: "Lore entity nodes — lab",
};

export default function LoreEntityNodesPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.HEARTGARDEN_ENABLE_DEV_ROUTES !== "1"
  ) {
    notFound();
  }
  return <LoreEntityNodesClient />;
}
