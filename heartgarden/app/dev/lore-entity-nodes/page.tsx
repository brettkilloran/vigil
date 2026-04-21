import type { Metadata } from "next";

import { LoreEntityNodesClient } from "./LoreEntityNodesClient";

export const metadata: Metadata = {
  title: "Lore entity nodes — lab",
  description: "Design previews for character, organization, and location canvas nodes.",
  robots: { index: false, follow: false },
};

export default function LoreEntityNodesPage() {
  return <LoreEntityNodesClient />;
}
