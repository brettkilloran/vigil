"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalStatusBar } from "@/src/components/foundation/ArchitecturalStatusBar";

const meta: Meta<typeof ArchitecturalStatusBar> = {
  title: "Heartgarden/Product UI/Canvas/Status bar",
  component: ArchitecturalStatusBar,
  args: {
    envLabel: "波途画電",
    showPulse: true,
    syncBootstrapPending: false,
    onExportGraphJson: () => {
      console.info("Export graph JSON");
    },
    exportGraphPaletteHint: "⌘K → Export graph JSON",
  },
  argTypes: {
    envLabel: { control: "text" },
    showPulse: { control: "boolean" },
    syncBootstrapPending: { control: "boolean" },
  },
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div
        style={{
          position: "relative",
          width: "100vw",
          height: "100vh",
          background: "var(--sem-surface-base)",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ArchitecturalStatusBar>;

export const Default: Story = {};

export const NoPulse: Story = {
  args: {
    showPulse: false,
  },
};

/** Boot gate on, no session yet — distinct from Neon offline / local-only. */
export const AwaitingBootAuth: Story = {
  args: {
    syncAwaitingBootAuth: true,
    syncBootstrapPending: false,
    syncOfflineNoSnapshot: false,
  },
};

export const WithCollabPeers: Story = {
  args: {
    collabNameplateEnabled: true,
    collabPeers: [
      {
        clientId: "11111111-1111-4111-8111-111111111111",
        initials: "AN",
        displayName: "Avery North",
        sigilLabel: "Thread",
        title: "Notes · Avery North · last seen 12s ago",
        ariaLabel: "Follow collaborator Avery North",
        muted: false,
        onFollow: () => {
          console.info("follow peer a");
        },
      },
      {
        clientId: "22222222-2222-4222-8222-222222222222",
        initials: "MC",
        displayName: "Mina Cedar",
        sigilLabel: "Quill",
        title: "Lore · Mina Cedar · last seen 2m ago · may be stale",
        ariaLabel: "Follow collaborator Mina Cedar",
        muted: true,
        onFollow: () => {
          console.info("follow peer b");
        },
      },
    ],
  },
};
