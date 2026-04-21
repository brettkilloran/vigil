"use client";

import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { Button } from "@/src/components/ui/Button";
import { LinkGraphOverlay } from "@/src/components/ui/LinkGraphOverlay";

function LinkGraphPlayground() {
  const [open, setOpen] = useState(true);
  const [spaceId, setSpaceId] = useState<string | null>(null);

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: "var(--sem-surface-base)",
        padding: 24,
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        color: "var(--sem-text-secondary)",
      }}
    >
      <p style={{ marginBottom: 12, maxWidth: 520, lineHeight: 1.5 }}>
        Full graph data loads from <code>/api/spaces/…/graph</code> in the Next app. In Storybook,
        use <strong>No cloud space</strong> for the empty-state copy, or open with a space id to
        see loading / error when the API is not available on this origin.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button type="button" size="sm" variant="primary" tone="solid" onClick={() => setOpen(true)}>
          Open overlay
        </Button>
        <Button type="button" size="sm" variant="neutral" tone="glass" onClick={() => setSpaceId(null)}>
          Clear space (no graph)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="neutral"
          tone="glass"
          onClick={() => setSpaceId("00000000-0000-4000-8000-000000000001")}
        >
          Set sample space id
        </Button>
      </div>
      <LinkGraphOverlay
        open={open}
        spaceId={spaceId}
        onClose={() => setOpen(false)}
        onSelectItem={() => setOpen(false)}
      />
    </div>
  );
}

const meta = {
  title: "Heartgarden/UI/Link graph overlay",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => <LinkGraphPlayground />,
};

/** Same modal as the canvas “link graph” action when no cloud space is active. */
export const NoSpaceSelected: Story = {
  render: () => (
    <LinkGraphOverlay
      open
      spaceId={null}
      onClose={() => {}}
      onSelectItem={() => {}}
    />
  ),
};
