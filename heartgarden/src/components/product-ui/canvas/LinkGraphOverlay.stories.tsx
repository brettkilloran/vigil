"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";

import { Button } from "@/src/components/ui/Button";
import { LinkGraphOverlay } from "@/src/components/ui/LinkGraphOverlay";

function LinkGraphPlayground() {
  const [open, setOpen] = useState(true);
  const [spaceId, setSpaceId] = useState<string | null>(null);

  return (
    <div
      style={{
        background: "var(--sem-surface-base)",
        color: "var(--sem-text-secondary)",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        height: "100vh",
        padding: 24,
        position: "relative",
        width: "100vw",
      }}
    >
      <p style={{ lineHeight: 1.5, marginBottom: 12, maxWidth: 520 }}>
        Full graph data loads from <code>/api/spaces/…/graph</code> in the Next
        app. In Storybook, use <strong>No cloud space</strong> for the
        empty-state copy, or open with a space id to see loading / error when
        the API is not available on this origin.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button
          onClick={() => setOpen(true)}
          size="sm"
          tone="solid"
          type="button"
          variant="primary"
        >
          Open overlay
        </Button>
        <Button
          onClick={() => setSpaceId(null)}
          size="sm"
          tone="glass"
          type="button"
          variant="default"
        >
          Clear space (no graph)
        </Button>
        <Button
          onClick={() => setSpaceId("00000000-0000-4000-8000-000000000001")}
          size="sm"
          tone="glass"
          type="button"
          variant="default"
        >
          Set sample space id
        </Button>
      </div>
      <LinkGraphOverlay
        onClose={() => setOpen(false)}
        onSelectItem={() => setOpen(false)}
        open={open}
        spaceId={spaceId}
      />
    </div>
  );
}

const meta = {
  parameters: {
    layout: "fullscreen",
  },
  title: "Heartgarden/Product UI/Canvas/Link graph overlay",
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
      onClose={() => {}}
      onSelectItem={() => {}}
      open
      spaceId={null}
    />
  ),
};
