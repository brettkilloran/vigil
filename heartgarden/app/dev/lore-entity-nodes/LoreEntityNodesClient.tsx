"use client";

import dynamic from "next/dynamic";

const LoreEntityNodeLab = dynamic(
  () =>
    import("@/src/components/dev/LoreEntityNodeLab").then(
      (m) => m.LoreEntityNodeLab
    ),
  {
    ssr: false,
    loading: () => (
      <div className="p-4 text-neutral-500 text-sm">Loading lab…</div>
    ),
  }
);

export function LoreEntityNodesClient() {
  return <LoreEntityNodeLab />;
}
