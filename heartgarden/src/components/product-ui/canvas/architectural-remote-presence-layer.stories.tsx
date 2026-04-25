"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import type { SpacePresencePeer } from "@/src/components/foundation/architectural-neon-api";
import { ArchitecturalRemotePresenceCursors } from "@/src/components/foundation/architectural-remote-presence-layer";

const peerA: SpacePresencePeer = {
  activeSpaceId: "space-1",
  camera: { x: 0, y: 0, zoom: 1 },
  clientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  displayName: "Avery North",
  pointer: { x: 120, y: 180 },
  sigil: "thread",
  updatedAt: new Date().toISOString(),
};

const peerB: SpacePresencePeer = {
  activeSpaceId: "space-1",
  camera: { x: 0, y: 0, zoom: 1 },
  clientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  displayName: "Mina Cedar",
  pointer: { x: 420, y: 260 },
  sigil: "quill",
  updatedAt: new Date().toISOString(),
};

const meta: Meta<typeof ArchitecturalRemotePresenceCursors> = {
  args: {
    nameplateEnabled: true,
    peers: [peerA, peerB],
    prefersReducedMotion: false,
  },
  argTypes: {
    prefersReducedMotion: { control: "boolean" },
  },
  component: ArchitecturalRemotePresenceCursors,
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
  title: "Heartgarden/Product UI/Canvas/Remote presence cursors",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalRemotePresenceCursors>;

export const TwoPeers: Story = {};

export const ReducedMotion: Story = {
  args: {
    prefersReducedMotion: true,
  },
};
