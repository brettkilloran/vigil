"use client";

import dynamic from "next/dynamic";

const LoreEntityNodeLab = dynamic(
  () =>
    import("@/src/components/dev/lore-entity-node-lab").then(
      (m) => m.LoreEntityNodeLab
    ),
  {
    loading: () => (
      <div className="p-4 text-neutral-500 text-sm">Loading lab…</div>
    ),
    ssr: false,
  }
);

export function LoreEntityNodesClient() {
  return <LoreEntityNodeLab />;
}
