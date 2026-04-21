import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LoreEntityNodesClient } from "./LoreEntityNodesClient";

export const metadata: Metadata = {
  title: "Lore entity nodes — lab",
  description: "Design previews for character, organization, and location canvas nodes.",
  robots: { index: false, follow: false },
};

export default function LoreEntityNodesPage() {
  if (process.env.NODE_ENV === "production" && process.env.HEARTGARDEN_ENABLE_DEV_ROUTES !== "1") {
    notFound();
  }
  return <LoreEntityNodesClient />;
}
