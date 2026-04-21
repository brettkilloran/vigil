"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import type { SpacePresencePeer } from "@/src/components/foundation/architectural-neon-api";
import { ArchitecturalRemotePresenceCursors } from "@/src/components/foundation/ArchitecturalRemotePresenceLayer";

const peerA: SpacePresencePeer = {
  clientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  activeSpaceId: "space-1",
  camera: { x: 0, y: 0, zoom: 1 },
  pointer: { x: 120, y: 180 },
  updatedAt: new Date().toISOString(),
};

const peerB: SpacePresencePeer = {
  clientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  activeSpaceId: "space-1",
  camera: { x: 0, y: 0, zoom: 1 },
  pointer: { x: 420, y: 260 },
  updatedAt: new Date().toISOString(),
};

const meta: Meta<typeof ArchitecturalRemotePresenceCursors> = {
  title: "Heartgarden/UI/Remote presence cursors",
  component: ArchitecturalRemotePresenceCursors,
  args: {
    peers: [peerA, peerB],
    prefersReducedMotion: false,
  },
  argTypes: {
    prefersReducedMotion: { control: "boolean" },
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
type Story = StoryObj<typeof ArchitecturalRemotePresenceCursors>;

export const TwoPeers: Story = {};

export const ReducedMotion: Story = {
  args: {
    prefersReducedMotion: true,
  },
};
