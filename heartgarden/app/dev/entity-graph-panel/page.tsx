import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EntityGraphPanelClient } from "@/app/dev/entity-graph-panel/EntityGraphPanelClient";

export const metadata: Metadata = {
  title: "Entity Graph Panel Lab",
  robots: {
    index: false,
    follow: false,
  },
};

export default function EntityGraphPanelPage() {
  if (process.env.NODE_ENV === "production" && process.env.HEARTGARDEN_ENABLE_DEV_ROUTES !== "1") {
    notFound();
  }
  return <EntityGraphPanelClient />;
}
