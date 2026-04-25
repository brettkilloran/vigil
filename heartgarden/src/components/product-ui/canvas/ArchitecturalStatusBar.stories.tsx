"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalStatusBar } from "@/src/components/foundation/ArchitecturalStatusBar";

const meta: Meta<typeof ArchitecturalStatusBar> = {
  args: {
    envLabel: "波途画電",
    exportGraphPaletteHint: "⌘K → Export graph JSON",
    onExportGraphJson: () => {
      console.info("Export graph JSON");
    },
    showPulse: true,
    syncBootstrapPending: false,
  },
  argTypes: {
    envLabel: { control: "text" },
    showPulse: { control: "boolean" },
    syncBootstrapPending: { control: "boolean" },
  },
  component: ArchitecturalStatusBar,
  decorators: [
    (Story) => (
      <div
        style={{
          background: "var(--sem-surface-base)",
          height: "100vh",
          position: "relative",
          width: "100vw",
        }}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
  title: "Heartgarden/Product UI/Canvas/Status bar",
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
        ariaLabel: "Follow collaborator Avery North",
        clientId: "11111111-1111-4111-8111-111111111111",
        displayName: "Avery North",
        initials: "AN",
        muted: false,
        onFollow: () => {
          console.info("follow peer a");
        },
        sigilLabel: "Thread",
        title: "Notes · Avery North · last seen 12s ago",
      },
      {
        ariaLabel: "Follow collaborator Mina Cedar",
        clientId: "22222222-2222-4222-8222-222222222222",
        displayName: "Mina Cedar",
        initials: "MC",
        muted: true,
        onFollow: () => {
          console.info("follow peer b");
        },
        sigilLabel: "Quill",
        title: "Lore · Mina Cedar · last seen 2m ago · may be stale",
      },
    ],
  },
};
