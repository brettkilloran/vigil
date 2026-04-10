import type { Metadata } from "next";

import { LoreEntityNodeLab } from "@/src/components/dev/LoreEntityNodeLab";

export const metadata: Metadata = {
  title: "Lore entity nodes — lab",
  description: "Design previews for character, organization, and location canvas nodes.",
  robots: { index: false, follow: false },
};

export default function LoreEntityNodesPage() {
  return <LoreEntityNodeLab />;
}
